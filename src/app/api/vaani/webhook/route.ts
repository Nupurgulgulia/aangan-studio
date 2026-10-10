import { NextResponse } from "next/server";
import { hasWebhookSecret } from "@/lib/auth";
import { handleWebhook } from "@/lib/pipeline";

export const maxDuration = 60;

// Register in Vaani (Settings -> Webhooks) as {APP_URL}/api/vaani/webhook?secret=VAANI_WEBHOOK_SECRET
export async function POST(req: Request) {
  if (!hasWebhookSecret(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await handleWebhook(await req.json());
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("webhook failed", e);
    // 500 so the sender can retry; processing is idempotent on call id.
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
