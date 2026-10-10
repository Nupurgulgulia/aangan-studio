import { NextResponse } from "next/server";
import { upsertByVaaniId } from "@/lib/db";
import { isAfterHours } from "@/lib/hours";
import { startWebCall } from "@/lib/vaani";

// Behind basic auth (middleware). Starts a browser test call with the agent.
export async function POST() {
  try {
    const call = await startWebCall();
    // Same as Vaani's call_started for a phone call: record start time for speed metrics.
    await upsertByVaaniId({
      vaani_call_id: call.roomName,
      caller_number: "browser test call",
      started_at: new Date().toISOString(),
      after_hours: isAfterHours(new Date()),
      answer_trigger: "test_call",
    });
    return NextResponse.json(call);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
