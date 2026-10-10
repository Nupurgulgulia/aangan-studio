import { NextResponse } from "next/server";
import { hasWebhookSecret } from "@/lib/auth";
import { BadPayloadError, flatEventCallId, handleWebhook } from "@/lib/pipeline";
import { sendDueReminders } from "@/lib/reminders";

export const maxDuration = 60;

// Register in Vaani (Settings -> Webhooks) as {APP_URL}/api/vaani/webhook?secret=VAANI_WEBHOOK_SECRET
export async function POST(req: Request) {
  if (!hasWebhookSecret(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body is not valid JSON" }, { status: 400 });
  }

  const b = body as { event?: string; room_name?: string; call_id?: string } | null;
  // One line per event so Vaani traffic is visible in Vercel runtime logs (no transcript or phone numbers).
  const keys = b && typeof b === "object" ? Object.keys(b).join(",") : typeof b;
  const data = (b as { data?: unknown } | null)?.data;
  const dataKeys = data && typeof data === "object" ? ` data.keys=${Object.keys(data).join(",")}` : "";
  console.info(`vaani webhook: event=${b?.event ?? "(none)"} call=${flatEventCallId(b) ?? "(none)"} keys=${keys}${dataKeys}`);

  try {
    const result = await handleWebhook(body);
    // Piggyback the 2-working-hour reminder check on call traffic; never fail the webhook over it.
    await sendDueReminders().catch((e) => console.error("reminders failed", e));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    // A broken payload won't fix itself on retry: 400. Anything else (DB, Gemini down): 500 so the sender retries;
    // processing is idempotent on call id.
    if (e instanceof BadPayloadError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("webhook failed", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
