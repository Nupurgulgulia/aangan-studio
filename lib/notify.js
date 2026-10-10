import { TIERS } from './tiers.js';
import { toIST } from './time.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatWhen(date) {
  const t = toIST(date);
  const h24 = Math.floor(t.minutes / 60);
  const m = String(t.minutes % 60).padStart(2, '0');
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${DAYS[t.weekday]} ${t.day} ${MONTHS[t.month]}, ${h12}:${m} ${h24 < 12 ? 'AM' : 'PM'}`;
}

export function formatHandoff(lead, booking) {
  const tier = TIERS[booking.tier];
  const lines = [
    `Chayya, front desk. New ${tier.label} lead for ${booking.designer_name}:`,
    booking.tier_reasons.join(', '),
    `Call by ${formatWhen(booking.call_by)} (${tier.window}) · Booked ${formatWhen(booking.slot)}`,
    booking.window_missed ? 'Warning: no free slot inside the window, booked the earliest available.' : null,
    '',
    `New qualified lead: ${lead.caller_name || 'Name not given'}${lead.area ? ', ' + lead.area : ''}`,
    `Project: ${lead.project_type || 'not stated'}${lead.size_sqft ? ', about ' + lead.size_sqft + ' sq ft' : ''}`,
    `Timeline: ${lead.timeline_text || 'not stated'}`,
    `Decision-maker: ${lead.decision_maker || 'not confirmed'}`,
    `Budget: ${lead.budget_note || 'not stated'}`,
    `Source: ${lead.source || 'not stated'}`,
    `Phone: ${lead.caller_phone || 'not captured'}`,
    lead.summary ? `Summary: ${lead.summary}` : null,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

export function statusKeyboard(callRowId) {
  const b = (text, status) => ({ text, callback_data: `s:${callRowId}:${status}` });
  return {
    inline_keyboard: [
      [b('Accept', 'accepted'), b('Called', 'called')],
      [b('Held', 'held'), b('Proposal sent', 'proposal')],
      [b('Won', 'won'), b('Lost', 'lost'), b('Not a fit', 'not_a_fit')],
    ],
  };
}

export async function sendTelegram(chatId, text, callRowId, fetchImpl = fetch) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return { skipped: true, reason: !token ? 'no bot token' : 'designer has no chat id' };
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: statusKeyboard(callRowId) }),
  });
  const body = await res.json();
  if (!body.ok) return { skipped: true, reason: body.description || 'telegram error' };
  return { sent: true, message_id: String(body.result.message_id) };
}

// A plain message with no buttons, for alerts that are not a lead (for example an escalation).
export async function sendPlainTelegram(chatId, text, fetchImpl = fetch) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return { skipped: true, reason: !token ? 'no bot token' : 'no chat id' };
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const body = await res.json();
  if (!body.ok) return { skipped: true, reason: body.description || 'telegram error' };
  return { sent: true, message_id: String(body.result.message_id) };
}
