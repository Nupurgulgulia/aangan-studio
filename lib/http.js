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
export function withCallId(body = {}, now = Date.now()) {
  if (body.call_id) return body;
  const digits = String(body.caller_phone || '').replace(/\D/g, '');
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
        if (!expected || !sameKey(given, expected)) return res.status(401).json({ error: 'unauthorised' });
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
