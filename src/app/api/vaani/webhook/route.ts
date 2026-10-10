import { NextResponse } from "next/server";
import { hasWebhookSecret } from "@/lib/auth";
import { BadPayloadError, handleWebhook } from "@/lib/pipeline";

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

  try {
    const result = await handleWebhook(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    // A broken payload won't fix itself on retry: 400. Anything else (DB, Gemini down): 500 so the sender retries;
    // processing is idempotent on call id.
    if (e instanceof BadPayloadError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("webhook failed", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
