import { NextResponse } from "next/server";
import { handleWebhook } from "@/lib/pipeline";
import { parseTranscript } from "@/lib/transcript";
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
    // A phone caller who says nothing becomes a callback task; a browser test call has nobody to call back.
    const turns = parseTranscript((event.data as { transcript?: unknown }).transcript);
    if (!turns.some((t) => t.speaker === "caller")) {
      return NextResponse.json(
        { pending: true, message: "No caller speech in this call yet (only the agent spoke). If you just hung up, try again in a minute." },
        { status: 202 },
      );
    }
    return NextResponse.json({ ok: true, ...(await handleWebhook(event)) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
