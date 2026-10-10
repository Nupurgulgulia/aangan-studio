import { formatWhen } from './notify.js';

// Chayya is the studio's front desk: the voice agent on the phone, and the sender of every message after the call.
export const AGENT_NAME = 'Chayya';

const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

// Short, human wording for what the caller wants: "3BHK full home in Baner".
export function projectPhrase(lead) {
  const type = String(lead.project_type || 'project').trim();
  return lead.area ? `${type} in ${String(lead.area).split(',')[0].trim()}` : type;
}

// What Chayya sends the caller right after the call. Plain, warm, and it says who will call and when.
export function customerConfirmation(lead, booking) {
  return [
    `Namaste ${first(lead.caller_name)}, this is ${AGENT_NAME} from Aangan Studio.`,
    `Thank you for calling and sharing the details of your ${projectPhrase(lead)}.`,
    `Your designer ${booking.designer_name} will call you on ${formatWhen(booking.slot)} to go through it with you. The first conversation is free and there is no obligation.`,
    `If that time does not suit you, just reply here and I will move it.`,
  ].join('\n');
}

// A day-before nudge to the caller.
export function customerReminder(lead, designerName, when) {
  return `Namaste ${first(lead.caller_name)}, ${AGENT_NAME} from Aangan Studio here. A reminder that ${designerName} will call you ${when}. Please keep your floor plan or any photos of the space handy. Reply here if you need to change the time.`;
}

// A reminder to a designer about something on their calendar.
export function designerReminder(designerName, what, when, where) {
  return `${AGENT_NAME} here. ${first(designerName)}, a reminder: ${what} ${when}${where ? `, ${where}` : ''}.`;
}

export async function recordMessage(db, m) {
  const rows = await db.query(
    `insert into messages (call_id, project_id, channel, sender, to_name, to_address, body, status, note, created_at, is_demo)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,coalesce($10, now()),$11) returning id`,
    [m.call_id ?? null, m.project_id ?? null, m.channel, AGENT_NAME, m.to_name ?? null, m.to_address ?? null, m.body,
      m.status || 'sent', m.note ?? null, m.created_at ?? null, m.is_demo === true],
  );
  return rows[0].id;
}
