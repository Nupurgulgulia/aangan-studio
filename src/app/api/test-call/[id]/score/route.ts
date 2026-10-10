import { NextResponse } from "next/server";
import { handleWebhook } from "@/lib/pipeline";
import { fetchFinishedCall } from "@/lib/vaani";

export const maxDuration = 60;

// Behind basic auth (middleware). Pulls the finished call from Vaani and runs the normal pipeline.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const event = await fetchFinishedCall(id);
    if (!event) {
      return NextResponse.json({ pending: true, message: "Vaani is still processing the call. Try again in a minute." }, { status: 202 });
    }
    return NextResponse.json({ ok: true, ...(await handleWebhook(event)) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
