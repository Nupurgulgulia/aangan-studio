import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { setStatus } from '../lib/store.js';
import { moveDeal } from '../lib/hubspot.js';

// Telegram webhook: designer taps a status button on the handoff message.
export default route({ auth: 'none' }, async (req) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers['x-telegram-bot-api-secret-token'] !== secret) return { ignored: true };
  const cb = req.body?.callback_query;
  const m = /^s:(\d+):([a-z_]+)$/.exec(cb?.data || '');
  if (!m) return { ignored: true };
  const [, id, status] = m;
  const db = getDb();
  await setStatus(db, Number(id), status, `via telegram by ${cb.from?.first_name || 'designer'}`);
  const rows = await db.query('select hubspot_deal_id from calls where id = $1', [Number(id)]);
  const moved = await moveDeal(rows[0]?.hubspot_deal_id, status).catch((e) => ({ error: String(e.message) }));
  if (process.env.TELEGRAM_BOT_TOKEN) {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cb.id, text: `Marked: ${status.replace('_', ' ')}` }),
    }).catch(() => {});
  }
  return { ok: true, status, moved };
});
