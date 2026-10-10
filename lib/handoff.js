import { getDb } from './db.js';
import { formatHandoff, sendPlainTelegram, sendTelegram } from './notify.js';
import { customerConfirmation, recordMessage } from './chayya.js';
import { createDeal } from './hubspot.js';

// After a booking, Chayya: messages the designer on Telegram, drafts the confirmation to the caller, and the lead is
// pushed to the CRM. Each step reports "skipped" instead of failing, so a missing key never loses the booking.
export async function notifyBooking(lead, booking) {
  const db = getDb();
  const results = { telegram: null, caller_message: null, hubspot: null };
  const handoff = formatHandoff(lead, booking);
  try {
    results.telegram = await sendTelegram(booking.telegram_chat_id, handoff, booking.call_row_id);
    if (results.telegram.sent) await db.query('update calls set telegram_message_id = $1 where id = $2', [results.telegram.message_id, booking.call_row_id]);
  } catch (e) {
    results.telegram = { skipped: true, reason: String(e.message) };
  }
  try {
    await recordMessage(db, {
      call_id: booking.call_row_id, channel: 'telegram', to_name: booking.designer_name, to_address: booking.telegram_chat_id,
      body: handoff, status: results.telegram.sent ? 'sent' : 'not_sent', note: results.telegram.sent ? null : results.telegram.reason,
    });
    // No WhatsApp or SMS provider is connected, so the confirmation to the caller is saved but not sent.
    if (lead.caller_phone) {
      await recordMessage(db, {
        call_id: booking.call_row_id, channel: 'whatsapp', to_name: lead.caller_name, to_address: lead.caller_phone,
        body: customerConfirmation(lead, booking), status: 'not_sent', note: 'WhatsApp is not connected yet, so this was not sent.',
      });
      results.caller_message = { saved: true, sent: false, reason: 'no WhatsApp provider connected' };
    }
  } catch (e) {
    results.caller_message = { skipped: true, reason: String(e.message) };
  }
  try {
    results.hubspot = await createDeal(lead, booking);
    if (results.hubspot.deal_id) await db.query('update calls set hubspot_deal_id = $1 where id = $2', [results.hubspot.deal_id, booking.call_row_id]);
  } catch (e) {
    results.hubspot = { skipped: true, reason: String(e.message) };
  }
  return results;
}

// The bot promised a senior callback within 15 minutes. With no front desk to watch a screen, tell people on
// Telegram. The alert goes to the first designer chat on file, and is sent once per call even if the agent retries.
export async function notifyEscalation(call, fetchImpl = fetch) {
  const db = getDb();
  const sent = await db.query('select telegram_message_id from calls where id = $1', [call.id]);
  if (sent[0]?.telegram_message_id) return { skipped: true, reason: 'already alerted' };
  const chat = await db.query('select telegram_chat_id from designers where telegram_chat_id is not null order by rr_order limit 1');
  const text = [
    'ESCALATION: call back within 15 minutes',
    `${call.caller_name || 'Name not given'}${call.caller_phone ? `, ${call.caller_phone}` : ''}`,
    call.summary || '',
    'Open "Needs attention" on the dashboard and mark it done after the call.',
  ].filter(Boolean).join('\n');
  const result = await sendPlainTelegram(chat[0]?.telegram_chat_id, text, fetchImpl);
  if (result.sent) await db.query('update calls set telegram_message_id = $1 where id = $2', [result.message_id, call.id]);
  await recordMessage(db, { call_id: call.id, channel: 'telegram', to_name: 'Studio team', to_address: chat[0]?.telegram_chat_id, body: text, status: result.sent ? 'sent' : 'not_sent', note: result.sent ? null : result.reason });
  return result;
}
