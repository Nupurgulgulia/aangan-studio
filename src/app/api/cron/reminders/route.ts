import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth";
import { sendDueReminders } from "@/lib/reminders";

/** Daily backstop (Vercel cron). Reminders also run on every call event; see lib/reminders.ts. */
export async function GET(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(token, process.env.CRON_SECRET ?? "")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, sent: await sendDueReminders() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
