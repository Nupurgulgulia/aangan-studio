import { NextResponse } from "next/server";
import { z } from "zod";
import { hasWebhookSecret } from "@/lib/auth";
import { createBooking } from "@/lib/calcom";
import { upsertByVaaniId } from "@/lib/db";

const body = z.object({
  vaani_call_id: z.string().min(1),
  start: z.string().min(1), // ISO datetime from /api/tools/slots
  name: z.string().default("Caller"),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

/** Vaani tool: books the consultation during the call and stores it on the call row. */
export async function POST(req: Request) {
  if (!hasWebhookSecret(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;
  try {
    const booking = await createBooking({ startIso: b.start, name: b.name, email: b.email, phone: b.phone });
    // The row may not exist yet (the webhook fires at call end); upsert by call id.
    await upsertByVaaniId({
          vaani_call_id: b.vaani_call_id,
          booking_start: booking.start ?? b.start,
          booking_url: booking.uid ? `https://cal.com/booking/${booking.uid}` : null,
    });
    return NextResponse.json({ ok: true, start: booking.start ?? b.start });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
