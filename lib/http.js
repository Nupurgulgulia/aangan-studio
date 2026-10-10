import { timingSafeEqual } from 'node:crypto';
import { getDb } from './db.js';
import { userFromRequest } from './auth.js';

function sameKey(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

// Connection strings and keys must never reach a log line or a response.
const redact = (text) => String(text).replace(/postgres(ql)?:\/\/[^\s"')]+/g, '<database address hidden>');

// The voice platform does not give the model a call id, so derive one. The same phone number within a
// 10 minute window maps to the same id, which makes a retried booking harmless.
// A number with fewer than 8 digits (the model sometimes sends "0" when speech-to-text lost it) is treated as not
// captured, and the designer is told so instead of being handed a wrong number.
export function withCallId(body = {}, now = Date.now()) {
  let digits = String(body.caller_phone ?? '').replace(/\D/g, '');
  if (body.caller_phone != null && digits.length < 8) {
    const note = 'Phone number was not captured on the call; check the recording in Vaani History.';
    body = { ...body, caller_phone: null, summary: body.summary ? `${body.summary} ${note}` : note };
    digits = '';
  }
  if (body.call_id) return body;
  const id = digits ? `auto-${digits}-${Math.floor(now / 600000)}` : `auto-${crypto.randomUUID()}`;
  return { ...body, call_id: id };
}

// Wraps a handler: method check, who is calling, JSON errors.
//   auth 'key'  - the voice agent's shared secret (x-api-key)
//   auth 'user' - a signed-in person (session cookie), optionally limited to some roles
//   auth 'none' - open (login, the Telegram webhook, which checks its own secret)
export function route({ method = 'POST', auth = 'key', roles, pendingChangeOk = false }, handler) {
  return async (req, res) => {
    try {
      if (req.method !== method) return res.status(405).json({ error: 'method not allowed' });
      if (auth === 'key') {
        const expected = process.env.AGENT_API_KEY;
        const given = req.headers['x-api-key'] || req.query?.key;
        const ok = Boolean(expected) && sameKey(given, expected);
        // One line per agent tool call, so a test call can be traced in the function logs. Never logs the key itself.
        console.log(`agent tool ${req.url?.split('?')[0] || ''} key=${given ? (ok ? 'valid' : 'wrong') : 'missing'} fields=${Object.keys(req.body || {}).join(',')}`);
        if (!ok) return res.status(401).json({ error: 'unauthorised' });
      }
      if (auth === 'user') {
        // A cross-site form cannot send a JSON content type, so this also blocks forged posts.
        if (method !== 'GET' && !/application\/json/i.test(req.headers['content-type'] || '')) {
          return res.status(415).json({ error: 'send JSON' });
        }
        const user = await userFromRequest(getDb(), req);
        if (!user) return res.status(401).json({ error: 'not signed in' });
        if (user.must_change && !pendingChangeOk) return res.status(403).json({ error: 'password_change_required' });
        if (roles && !roles.includes(user.role)) return res.status(403).json({ error: 'not allowed for your role' });
        req.user = user;
      }
      const result = await handler(req, res);
      if (result !== undefined && !res.writableEnded) res.status(200).json(result);
    } catch (err) {
      console.error('request failed:', redact(err.message || err));
      res.status(500).json({ error: 'server error' });
    }
  };
}
