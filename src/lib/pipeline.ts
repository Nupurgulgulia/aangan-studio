import { countAssignedDesigners, findByVaaniId, findRecentLeadByPhone, getCall, updateCall, upsertByVaaniId } from "./db";
import { findRecentBooking } from "./calcom";
import { geminiCostInr, vaaniCostInr } from "./cost";
import { designerEmailHtml, escalationEmailHtml, sendEmail } from "./email";
import { extractCall, FIELD_KEYS } from "./gemini";
import { createDeal } from "./hubspot";
import { isAfterHours } from "./hours";
import { checkAgentForPriceQuote } from "./pricing-guard";
import { quoteIsInCallerSpeech } from "./rubric";
import { decide, normalisePhone, toLeadFields } from "./rules";
import { MIN_CALLER_TURNS, parseTranscript, turnsToText } from "./transcript";
import { CRITERIA, type CallRow, type Criteria, type Label } from "./types";

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
  /** Vaani's post-call extraction (same keys as gemini FIELD_KEYS). */
  entities?: Record<string, unknown>;
  /** Cost Vaani reported for the call, if any (INR); otherwise estimated per minute. */
  costInr?: number | null;
}

/** Vaani timestamps may come without a zone (they are UTC); returns null if unparseable. */
export function vaaniTime(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const s = String(v);
  const d = new Date(/[zZ]|[+-]dd:?dd$/.test(s) || !/T|d:d/.test(s) ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Caller's number from a live Vaani event: top-level "from", or data.caller / data.phone_number. */
export function eventCallerNumber(b: any): string | undefined {
  return normalisePhone(b?.from) ?? normalisePhone(b?.data?.caller) ?? normalisePhone(b?.data?.phone_number) ?? normalisePhone(b?.phone_number);
}

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
    const entities = (d.entities ?? d.entity ?? {}) as Record<string, unknown>;
    const cost = Number(d.cost_inr ?? d.cost);
    return {
      vaaniCallId: String(id),
      callerNumber: eventCallerNumber(b) ?? null,
      // Live payloads carry call_started_at; otherwise estimate from the processing time.
      startedAt: vaaniTime(d.call_started_at) ?? new Date(processedAt.getTime() - durationSec * 1000),
      durationSec,
      answeredAfterSec: (() => {
        const picked = vaaniTime(d.picked_up_at);
        const from = vaaniTime(d.call_ringing_at) ?? vaaniTime(d.call_dialing_at) ?? vaaniTime(d.call_started_at);
        return picked && from ? Math.max(0, Math.round((picked.getTime() - from.getTime()) / 1000)) : null;
      })(),
      answerTrigger: null,
      transcript: d.transcript ?? "",
      bookingStart: bookingFromEntities(entities),
      entities,
      costInr: Number.isFinite(cost) && cost > 0 ? cost : null,
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
    entities: b.entities,
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
      `${call.booking_start ? "Consultation booked" : "New lead, call back within 4 hours"}: ${call.caller_name || call.caller_number || "phone enquiry"} - ${call.brief?.location || "Pune"}`,
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

/** Existing client: alert the founder / senior team at once (senior callback within 15 minutes). */
async function escalate(callId: string): Promise<void> {
  const call = await getCall(callId);
  const to = process.env.ESCALATION_EMAIL || process.env.FRONT_DESK_EMAIL;
  if (!call || !to) return;
  try {
    await sendEmail(
      to,
      `URGENT: existing client, call back within 15 minutes: ${call.caller_name || call.caller_number || "caller"}`,
      escalationEmailHtml(call),
    );
  } catch (e) {
    await updateCall(callId, { email_error: String(e) });
  }
}

// Only real enquiries become deals (qualified and review); declines and escalations stay out of the pipeline.
async function trySyncHubspot(callId: string) {
  try {
    const call = await getCall(callId);
    if (!call || call.hubspot_deal_id || !process.env.HUBSPOT_TOKEN) return;
    if (call.label !== "qualified" && call.label !== "borderline") return;
    if (!call.fields) return; // dropped/empty call or failed extraction: a front-desk task, not a CRM deal
    const dealId = await createDeal(call);
    await updateCall(callId, { hubspot_deal_id: dealId, hubspot_error: null });
  } catch (e) {
    await updateCall(callId, { hubspot_error: String(e) });
  }
}

/** Gemini's extraction first; Vaani's own extraction fills anything Gemini left empty. */
export function mergeExtraction(gemini: Record<string, string> | null, vaani: Record<string, unknown> | undefined) {
  const out: Record<string, unknown> = {};
  for (const k of FIELD_KEYS) {
    const g = gemini?.[k];
    out[k] = g != null && String(g).trim() !== "" ? g : vaani?.[k];
  }
  return out;
}

export async function processCall(n: NormalizedCall): Promise<{ id: string; label: Label | null; duplicate?: boolean }> {
  const turns = parseTranscript(n.transcript);
  const transcriptText = turnsToText(turns);

  // Upsert on vaani_call_id: call_started (or the test-call page) may have created the row already.
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
    vaani_cost_inr: n.costInr ?? vaaniCostInr(n.durationSec),
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
      const x = await extractCall(transcriptText, startedAt);
      const lf = toLeadFields(mergeExtraction(x.fields, n.entities));
      // Never decline on a place the caller didn't actually say.
      if (lf.location_text) lf.location_verified = quoteIsInCallerSpeech(lf.location_text, turns);
      const d = decide(lf, startedAt);
      label = d.label;

      // Rubric view: the rule's verdict per criterion, with the caller's verbatim words where we have them.
      const criteria = Object.fromEntries(
        CRITERIA.map((k) => {
          const q = x.evidence[k] ?? "";
          return [k, { status: d.criteria[k].status, note: d.criteria[k].note, evidence_quote: q && quoteIsInCallerSpeech(q, turns) ? q : "" }];
        }),
      ) as Criteria;

      // Booking: the agent's claim is checked against Cal.com when we have the caller's email.
      let bookingStart = n.bookingStart ?? null;
      if (!bookingStart && lf.email && (lf.consultation_booked || label === "qualified")) {
        bookingStart = (await findRecentBooking(lf.email).catch(() => null))?.start ?? null;
      }

      scored = {
        label,
        reason: x.reason,
        reasons: d.reasons,
        criteria,
        fields: lf,
        brief: x.brief,
        caller_name: lf.name ?? null,
        caller_email: lf.email ?? null,
        caller_number: n.callerNumber ?? lf.mobile ?? undefined,
        booking_start: bookingStart ?? undefined,
        uncertainty: d.notes,
        status: label === "qualified" ? "received" : label === "not_a_fit" ? "closed" : "in_review",
        ...(label === "not_a_fit"
          ? { stage: "lost", stage_changed_at: new Date().toISOString(), lost_reason: "Outside Pune / PCMC (declined politely on the call)" }
          : {}),
        ai_cost_inr: geminiCostInr(x.inputTokens, x.outputTokens),
      };
    } catch (e) {
      // Extraction failure must not lose the lead: park it for a human.
      label = "borderline";
      scored = { label, reason: "Automatic scoring failed; needs a human look.", scoring_error: String(e), status: "in_review" };
    }
  }

  const rowId = await upsertByVaaniId({ ...base, ...priceFields, ...scored });

  if (label === "qualified") {
    // Same caller again within 2 hours (dropped line, call-back): the designer already has the lead.
    const phone = (scored.caller_number as string | undefined) ?? n.callerNumber ?? undefined;
    const earlier = phone ? await findRecentLeadByPhone(phone, rowId, 2) : null;
    if (earlier?.designer_name) {
      await updateCall(rowId, {
        status: "with_designer",
        designer_name: earlier.designer_name,
        designer_email: earlier.designer_email,
        review_note: `Follow-up call to an earlier lead (${earlier.id}); designer not emailed again.`,
      });
    } else {
      await forwardToDesigner(rowId);
    }
  }
  if (label === "escalate") await escalate(rowId);
  await trySyncHubspot(rowId);
  return { id: rowId, label };
}

export function flatEventCallId(b: any): string | undefined {
  const id =
    b?.room_name ?? b?.call_id ?? b?.callId ?? b?.room ?? b?.session_id ??
    b?.data?.room_name ?? b?.data?.call_id ?? b?.data?.room ?? b?.data?.session_id ??
    b?.payload?.room_name ?? b?.payload?.call_id;
  return id ? String(id) : undefined;
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

  // Vaani's docs put room_name at the top level of lifecycle events, but live events arrive
  // without it there; accept the other places it can appear.
  const roomName = flatEventCallId(b);
  if (!roomName) return { kind: "ignored", event };

  if (event === "call_started") {
    const existing = await findByVaaniId(String(roomName));
    if (!existing) {
      await upsertByVaaniId({
        vaani_call_id: String(roomName),
        caller_number: eventCallerNumber(b),
        started_at: new Date().toISOString(),
        after_hours: isAfterHours(new Date()),
      });
    }
    return { kind: "recorded", event };
  }

  if (event === "user_picked_up_at") {
    const existing = await findByVaaniId(String(roomName));
    if (existing && !existing.label) {
      const picked = vaaniTime(b?.data?.picked_up_at) ?? new Date();
      const secs = Math.max(0, Math.round((picked.getTime() - new Date(existing.started_at).getTime()) / 1000));
      await updateCall(existing.id, { answered_after_sec: secs });
    }
    return { kind: "recorded", event };
  }

  return { kind: "ignored", event };
}
