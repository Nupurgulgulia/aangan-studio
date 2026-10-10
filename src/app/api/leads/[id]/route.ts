import { NextResponse } from "next/server";
import { z } from "zod";
import { getCall, updateCall } from "@/lib/db";
import { syncDealOutcome } from "@/lib/hubspot";
import { forwardToDesigner } from "@/lib/pipeline";
import { STAGES } from "@/lib/types";

// Behind the basic-auth middleware (see src/middleware.ts).
const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({
    action: z.literal("set_stage"),
    stage: z.enum(STAGES as [string, ...string[]]),
    deal_value_inr: z.number().nonnegative().optional(),
    lost_reason: z.string().optional(),
  }),
  // Front desk review of borderline / not-a-fit leads
  z.object({ action: z.literal("review_forward"), reviewer: z.string().min(1) }),
  z.object({ action: z.literal("review_close"), reviewer: z.string().min(1), note: z.string().min(3) }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const a = parsed.data;
  const call = await getCall(id);
  if (!call) return NextResponse.json({ error: "not found" }, { status: 404 });
  const now = new Date().toISOString();

  switch (a.action) {
    case "accept":
      await updateCall(id, { accepted_at: now, stage: "accepted", stage_changed_at: now });
      break;

    case "set_stage": {
      if (a.stage === "lost" && !a.lost_reason) {
        return NextResponse.json({ error: "lost_reason is required when marking lost" }, { status: 400 });
      }
      if (a.stage === "won" && a.deal_value_inr == null && call.deal_value_inr == null) {
        return NextResponse.json({ error: "deal_value_inr is required when marking won" }, { status: 400 });
      }
      const patch: Record<string, unknown> = {
        stage: a.stage,
        stage_changed_at: now,
        ...(a.deal_value_inr != null ? { deal_value_inr: a.deal_value_inr } : {}),
        ...(a.stage === "lost" ? { lost_reason: a.lost_reason, status: "closed" } : {}),
        ...(a.stage === "won" ? { status: "closed" } : {}),
      };
      await updateCall(id, patch);
      if (call.hubspot_deal_id) {
        try {
          await syncDealOutcome(call.hubspot_deal_id, a.stage as any, {
            amountInr: a.deal_value_inr ?? call.deal_value_inr,
            lostReason: a.lost_reason,
          });
        } catch (e) {
          await updateCall(id, { hubspot_error: String(e) });
        }
      }
      break;
    }

    case "review_forward":
      await forwardToDesigner(id, a.reviewer);
      break;

    case "review_close": {
      await updateCall(id, {
          status: "closed",
          stage: "lost",
          stage_changed_at: now,
          lost_reason: a.note,
          review_note: a.note,
          reviewed_by: a.reviewer,
          reviewed_at: now,
        });
      if (call.hubspot_deal_id) {
        await syncDealOutcome(call.hubspot_deal_id, "lost", { lostReason: a.note }).catch(() => {});
      }
      break;
    }
  }
  return NextResponse.json({ ok: true });
}
