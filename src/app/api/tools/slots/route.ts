import { NextResponse } from "next/server";
import { hasWebhookSecret } from "@/lib/auth";
import { getSlots } from "@/lib/calcom";

/** Vaani tool: GET ?from=ISO&to=ISO -> available consultation slots. */
export async function GET(req: Request) {
  if (!hasWebhookSecret(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const u = new URL(req.url);
  const from = u.searchParams.get("from") ?? new Date().toISOString();
  const to = u.searchParams.get("to") ?? new Date(Date.now() + 7 * 86_400_000).toISOString();
  try {
    return NextResponse.json(await getSlots(from, to));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
