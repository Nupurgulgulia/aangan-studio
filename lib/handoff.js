import { getDb } from './db.js';
import { formatHandoff, formatWhen, sendPlainTelegram, sendTelegram } from './notify.js';
import { customerConfirmation, recordMessage } from './chayya.js';
import { createDeal } from './hubspot.js';
import { dashboardLink, sendEmail } from './email.js';
import { TIERS } from './tiers.js';

// After a booking, Chayya: emails the designer the handoff brief (Resend), also pings Telegram if a bot is set up,
// drafts the confirmation to the caller, and the lead is pushed to the CRM. Each step reports "skipped" instead of
// failing, so a missing key never loses the booking.
export async function notifyBooking(lead, booking) {
  const db = getDb();
  const results = { email: null, telegram: null, caller_message: null, hubspot: null };
  const handoff = formatHandoff(lead, booking);
  const tier = TIERS[booking.tier];
  const subject = `${tier.label} lead: ${lead.caller_name || 'New caller'}${lead.area ? `, ${lead.area}` : ''} · call by ${formatWhen(booking.call_by)}`;

  try {
    results.email = await sendEmail({ to: booking.designer_email, subject, text: handoff, link: dashboardLink(`#/call/${booking.call_row_id}`) });
    if (results.email.sent) await db.query('update calls set email_message_id = $1 where id = $2', [results.email.message_id, booking.call_row_id]);
  } catch (e) {
    results.email = { skipped: true, reason: String(e.message) };
  }
  if (process.env.TELEGRAM_BOT_TOKEN && booking.telegram_chat_id) {
    try {
      results.telegram = await sendTelegram(booking.telegram_chat_id, handoff, booking.call_row_id);
      if (results.telegram.sent) await db.query('update calls set telegram_message_id = $1 where id = $2', [results.telegram.message_id, booking.call_row_id]);
    } catch (e) {
      results.telegram = { skipped: true, reason: String(e.message) };
    }
  }
  try {
    await recordMessage(db, {
      call_id: booking.call_row_id, channel: 'email', to_name: booking.designer_name, to_address: booking.designer_email,
      body: handoff, status: results.email.sent ? 'sent' : 'not_sent', note: results.email.sent ? null : results.email.reason,
    });
    if (results.telegram) {
      await recordMessage(db, {
        call_id: booking.call_row_id, channel: 'telegram', to_name: booking.designer_name, to_address: booking.telegram_chat_id,
        body: handoff, status: results.telegram.sent ? 'sent' : 'not_sent', note: results.telegram.sent ? null : results.telegram.reason,
      });
    }
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

// The bot promised a senior callback within 15 minutes. With no front desk to watch a screen, email the escalation
// address (Nikhil or a senior designer), and Telegram too if a bot is set up. Sent once per call even if the agent retries.
export async function notifyEscalation(call, fetchImpl = fetch) {
  const db = getDb();
  const sent = await db.query('select email_message_id, telegram_message_id from calls where id = $1', [call.id]);
  if (sent[0]?.email_message_id || sent[0]?.telegram_message_id) return { skipped: true, reason: 'already alerted' };
  const first = await db.query('select email, telegram_chat_id from designers where active order by rr_order limit 1');
  const to = process.env.ESCALATION_EMAIL || first[0]?.email;
  const text = [
    'ESCALATION: call back within 15 minutes',
    `${call.caller_name || 'Name not given'}${call.caller_phone ? `, ${call.caller_phone}` : ''}`,
    call.summary || '',
    'Open "Needs attention" on the dashboard and mark it done after the call.',
  ].filter(Boolean).join('\n');
  const result = await sendEmail({ to, subject: `ESCALATION: call ${call.caller_name || 'the caller'} back within 15 minutes`, text, link: dashboardLink('#/attention') }, fetchImpl);
  if (result.sent) await db.query('update calls set email_message_id = $1 where id = $2', [result.message_id, call.id]);
  await recordMessage(db, { call_id: call.id, channel: 'email', to_name: 'Studio team', to_address: to, body: text, status: result.sent ? 'sent' : 'not_sent', note: result.sent ? null : result.reason });

  if (process.env.TELEGRAM_BOT_TOKEN && first[0]?.telegram_chat_id) {
    const tg = await sendPlainTelegram(first[0].telegram_chat_id, text, fetchImpl);
    if (tg.sent) await db.query('update calls set telegram_message_id = $1 where id = $2', [tg.message_id, call.id]);
    await recordMessage(db, { call_id: call.id, channel: 'telegram', to_name: 'Studio team', to_address: first[0].telegram_chat_id, body: text, status: tg.sent ? 'sent' : 'not_sent', note: tg.sent ? null : tg.reason });
  }
  return result;
}
