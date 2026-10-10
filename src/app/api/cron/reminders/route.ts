import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth";
import { listAwaitingAcceptance, updateCall } from "@/lib/db";
import { reminderEmailHtml, sendEmail } from "@/lib/email";
import { workingMinutesBetween } from "@/lib/hours";

/** Every 30 min: qualified leads not accepted within 2 working hours remind the front desk. */
export async function GET(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(token, process.env.CRON_SECRET ?? "")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const to = process.env.FRONT_DESK_EMAIL;
  if (!to) return NextResponse.json({ error: "FRONT_DESK_EMAIL not set" }, { status: 500 });

  const pending = await listAwaitingAcceptance();

  const now = new Date();
  let sent = 0;
  for (const c of pending) {
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
  return NextResponse.json({ ok: true, sent });
}
