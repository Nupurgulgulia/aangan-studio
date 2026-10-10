import { countAssignedDesigners, findByVaaniId, getCall, updateCall, upsertByVaaniId } from "./db";
import { geminiCostInr, vaaniCostInr } from "./cost";
import { designerEmailHtml, sendEmail } from "./email";
import { scoreTranscript } from "./gemini";
import { createDeal } from "./hubspot";
import { isAfterHours } from "./hours";
import { checkAgentForPriceQuote } from "./pricing-guard";
import { decide, verifyEvidence } from "./rubric";
import { MIN_CALLER_TURNS, parseTranscript, turnsToText } from "./transcript";
import type { CallRow, Label } from "./types";

/** The payload itself is unusable; retrying it won't help (route returns 400). */
export class BadPayloadError extends Error {}

export interface NormalizedCall {
  vaaniCallId: string;
  callerNumber: string | null;
  startedAt: Date;
  durationSec: number;
  answeredAfterSec: number | null;
  answerTrigger: string | null;
  transcript: unknown;
  /** Consultation time the agent booked via Vaani's Cal.com integration, if extracted. */
  bookingStart?: string | null;
}

/**
 * Vaani extracts these per call (configured in scripts/setup-vaani-agent.mjs).
 * Booking results are not in Vaani's payload otherwise, so we ask for them here.
 */
function bookingFromEntities(entities: any): string | null {
  if (!entities) return null;
  const booked = String(entities.consultation_booked ?? "").toLowerCase();
  if (!["yes", "true"].includes(booked)) return null;
  const t = new Date(String(entities.consultation_time ?? ""));
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

/**
 * Maps a call-ended payload to our shape. Handles Vaani's `call_postprocessing`
 * webhook (docs.vaanivoice.ai/guides/webhook-setup):
 *   { event, call_id, timestamp, data: { call_id, room_name, call_duration (ms),
 *     transcript, summary, entities, dispositions, recording_url, end_reason } }
 * and a flat test shape used by fixtures/scripts.
 */
export function normalizePayload(b: any): NormalizedCall {
  if (b?.event === "call_postprocessing") {
    const d = b.data ?? {};
    const id = b.call_id ?? d.call_id ?? d.room_name;
    if (!id) throw new BadPayloadError("call_postprocessing payload has no call id");
    const durationSec = Math.round((Number(d.call_duration) || 0) / 1000);
    const processedAt = b.timestamp ? new Date(b.timestamp) : new Date();
    return {
      vaaniCallId: String(id),
      callerNumber: null, // not in this payload; captured from call_started
      startedAt: new Date(processedAt.getTime() - durationSec * 1000), // fallback if call_started was missed
      durationSec,
      answeredAfterSec: null,
      answerTrigger: null,
      transcript: d.transcript ?? "",
      bookingStart: bookingFromEntities(d.entities),
    };
  }

  const id = b.call_id ?? b.id ?? b.callId;
  if (!id) throw new BadPayloadError("payload has no call id");
  const started = new Date(b.started_at ?? b.start_time ?? b.startedAt ?? Date.now());
  const ended = b.ended_at ?? b.end_time ? new Date(b.ended_at ?? b.end_time) : null;
  const duration = Number(b.duration_sec ?? b.duration ?? (ended ? (ended.getTime() - started.getTime()) / 1000 : 0)) || 0;
  return {
    vaaniCallId: String(id),
    callerNumber: b.caller_number ?? b.from ?? b.from_number ?? null,
    startedAt: started,
    durationSec: Math.round(duration),
    answeredAfterSec: b.answered_after_sec != null ? Number(b.answered_after_sec) : null,
    answerTrigger: b.trigger ?? null,
    transcript: b.transcript ?? b.messages ?? "",
  };
}

function pickDesigner(roundRobinIndex: number): { name: string; email: string } {
  const list = JSON.parse(process.env.DESIGNERS || "[]") as { name: string; email: string }[];
  if (!list.length) throw new Error("DESIGNERS env is empty");
  return list[roundRobinIndex % list.length];
}

/** Email the brief to a designer and mark the call as with_designer. Safe to call from review approval too. */
export async function forwardToDesigner(callId: string, forwardedBy?: string): Promise<void> {
  const call = await getCall(callId);
  if (!call) throw new Error("call not found");
  const designer = pickDesigner(await countAssignedDesigners());
  const updated: CallRow = { ...call, designer_name: designer.name, designer_email: designer.email };

  const patch: Record<string, unknown> = {
    designer_name: designer.name,
    designer_email: designer.email,
    status: "with_designer",
    ...(forwardedBy ? { reviewed_by: forwardedBy, reviewed_at: new Date().toISOString() } : {}),
  };
  try {
    await sendEmail(
      designer.email,
      `New lead: ${call.caller_name || call.caller_number || "phone enquiry"} - ${call.brief?.location || "Pune"}`,
      designerEmailHtml(updated, forwardedBy),
    );
    patch.email_error = null;
  } catch (e) {
    // The lead must never be lost because email failed: it stays visible to the front desk.
    patch.status = "in_review";
    patch.email_error = String(e);
  }
  await updateCall(callId, patch);
}

async function trySyncHubspot(callId: string) {
  try {
    const call = await getCall(callId);
    if (!call || call.hubspot_deal_id || !process.env.HUBSPOT_TOKEN) return;
    const dealId = await createDeal(call);
    await updateCall(callId, { hubspot_deal_id: dealId, hubspot_error: null });
  } catch (e) {
    await updateCall(callId, { hubspot_error: String(e) });
  }
}

export async function processCall(n: NormalizedCall): Promise<{ id: string; label: Label | null; duplicate?: boolean }> {
  const turns = parseTranscript(n.transcript);
  const transcriptText = turnsToText(turns);

  // Upsert on vaani_call_id: call_started (or the booking tool) may have created the row already.
  // Columns left undefined are not written, so values captured earlier are kept.
  const existing = await findByVaaniId(n.vaaniCallId);
  if (existing?.label) return { id: existing.id, label: existing.label, duplicate: true };
  const startedAt = existing ? new Date(existing.started_at) : n.startedAt;

  const base = {
    vaani_call_id: n.vaaniCallId,
    caller_number: n.callerNumber ?? undefined,
    started_at: existing ? undefined : n.startedAt.toISOString(),
    duration_sec: n.durationSec,
    answered_after_sec: n.answeredAfterSec ?? undefined,
    after_hours: isAfterHours(startedAt),
    answer_trigger: n.answerTrigger ?? undefined,
    booking_start: n.bookingStart ?? undefined,
    transcript: transcriptText,
    vaani_cost_inr: vaaniCostInr(n.durationSec),
  };

  const pricing = checkAgentForPriceQuote(turns);
  const priceFields = {
    pricing_violation: pricing.violated,
    pricing_violation_text: pricing.violated ? pricing.offending.join("\n---\n") : null,
  };

  const callerTurns = turns.filter((t) => t.speaker === "caller").length;
  let scored: Record<string, unknown>;
  let label: Label;

  if (callerTurns < MIN_CALLER_TURNS) {
    // Dropped or empty call: never discard it, give the front desk a callback task.
    label = "borderline";
    scored = {
      label,
      reason: "Call too short to score (caller dropped or said almost nothing). Callback recommended.",
      status: "in_review",
    };
  } else {
    try {
      const s = await scoreTranscript(transcriptText);
      const criteria = verifyEvidence(s.criteria, turns);
      const d = decide(criteria);
      label = d.label;
      scored = {
        label,
        reason: s.reason,
        criteria,
        brief: s.brief,
        caller_name: s.brief.caller_name === "not stated" ? null : s.brief.caller_name,
        uncertainty: d.uncertainty,
        status: label === "qualified" ? "received" : "in_review",
        ai_cost_inr: geminiCostInr(s.inputTokens, s.outputTokens),
      };
    } catch (e) {
      // Scoring failure must not lose the lead: park it for a human.
      label = "borderline";
      scored = { label, reason: "Automatic scoring failed; needs a human look.", scoring_error: String(e), status: "in_review" };
    }
  }

  const rowId = await upsertByVaaniId({ ...base, ...priceFields, ...scored });

  if (label === "qualified") await forwardToDesigner(rowId);
  await trySyncHubspot(rowId);
  return { id: rowId, label };
}

export type WebhookResult =
  | ({ kind: "processed" } & Awaited<ReturnType<typeof processCall>>)
  | { kind: "recorded"; event: string }
  | { kind: "ignored"; event: string };

/**
 * Vaani posts every lifecycle event for the account to one URL. We use three:
 *  - call_started: capture the caller's number and start time
 *  - user_picked_up_at: time from connect to the agent answering
 *  - call_postprocessing: transcript is ready -> score and route
 * A payload without `event` is treated as a finished call (fixtures/scripts).
 */
export async function handleWebhook(b: any): Promise<WebhookResult> {
  const event: string | undefined = b?.event;
  if (event === undefined || event === "call_postprocessing") {
    return { kind: "processed", ...(await processCall(normalizePayload(b))) };
  }

  const roomName = b.room_name ?? b.call_id;
  if (!roomName) return { kind: "ignored", event };

  if (event === "call_started") {
    const existing = await findByVaaniId(String(roomName));
    if (!existing) {
      await upsertByVaaniId({
        vaani_call_id: String(roomName),
        caller_number: b.phone_number ?? undefined,
        started_at: new Date().toISOString(),
        after_hours: isAfterHours(new Date()),
      });
    }
    return { kind: "recorded", event };
  }

  if (event === "user_picked_up_at") {
    const existing = await findByVaaniId(String(roomName));
    if (existing && !existing.label) {
      const secs = Math.max(0, Math.round((Date.now() - new Date(existing.started_at).getTime()) / 1000));
      await updateCall(existing.id, { answered_after_sec: secs });
    }
    return { kind: "recorded", event };
  }

  return { kind: "ignored", event };
}
