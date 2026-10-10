import { listAwaitingAcceptance, updateCall } from "./db";
import { reminderEmailHtml, sendEmail } from "./email";
import { workingMinutesBetween } from "./hours";

/**
 * Qualified leads not accepted within 2 working hours: remind the front desk once.
 * Runs from the daily cron AND opportunistically on every call event, so it keeps
 * working on Vercel Hobby, where crons may only run once a day.
 */
export async function sendDueReminders(now = new Date()): Promise<number> {
  const to = process.env.FRONT_DESK_EMAIL;
  if (!to) throw new Error("FRONT_DESK_EMAIL not set");
  let sent = 0;
  for (const c of await listAwaitingAcceptance()) {
    // Clock starts when the lead reached the designer (call time is a fine proxy).
    if (workingMinutesBetween(new Date(c.created_at), now) < 120) continue;
    try {
      await sendEmail(to, "Lead not accepted within 2 working hours", reminderEmailHtml(c));
      await updateCall(c.id, { reminded_at: now.toISOString() });
      sent++;
    } catch (e) {
      console.error("reminder failed", c.id, e);
    }
  }
  return sent;
}
