import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { CRITERIA, type Brief } from "./types";

// Gemini EXTRACTS what the caller said (same field names as the Vaani data points); it decides
// nothing. lib/rules.ts turns the fields into the outcome. pricing.md is never sent to it.

export const FIELD_KEYS = [
  "caller_type", "caller_name", "caller_mobile", "caller_email", "project_intent", "property_category",
  "location_text", "carpet_area_sqft", "bhk", "scope_type", "rooms_count", "completion_text",
  "completion_needed_by", "timeline_flexible", "budget_text", "budget_min_inr", "budget_max_inr",
  "decision_maker", "structural_changes", "consultation_booked", "notes_from_call",
] as const;

const FIELD_GUIDE = `
caller_type: "existing_client" if they mention an ongoing project, an assigned designer or a complaint about work in progress; "new_enquiry" for a new project; "other" otherwise.
caller_name: the caller's name.
caller_mobile: the mobile number the caller gave, digits only (e.g. 9876543210).
caller_email: the email the caller gave, lowercase.
project_intent: "design_and_execution", "advice_only" (ideas, a visit, a second opinion), "decor_only" (styling, colours, rearranging), "furniture_only", "vastu_only", or "unclear".
property_category: residential | office | clinic | studio | restaurant | hotel | retail | gym | other | unknown.
location_text: the locality exactly as the caller said it (e.g. "Baner", "Talegaon"); not just "Pune" if they named an area.
carpet_area_sqft: carpet area in sq ft as a plain number.
bhk: number of bedrooms as a plain number.
scope_type: full_home | partial (a floor or some rooms) | single_room | commercial_fitout | unknown.
rooms_count: for partial/single-room projects, number of rooms.
completion_text: when they need it complete, in their own words.
completion_needed_by: that date as YYYY-MM-DD, using the CALL DATE as today; for a month only, use the last day of the next occurrence of that month. "" if not given or flexible.
timeline_flexible: "yes" if they said no rush / flexible / whenever, else "no".
budget_text: their budget answer in their own words (e.g. "around 15 lakhs", "not decided").
budget_min_inr / budget_max_inr: the budget in rupees as plain numbers (15 lakhs = 1500000; a single figure goes in budget_max_inr). "" if not given.
decision_maker: "yes" (caller decides) | "authorised" (deciding with someone who knows they're calling) | "no" (just researching for someone else) | "unclear".
structural_changes: "yes" if they asked to move or break walls, else "no".
consultation_booked: "yes" only if the agent confirmed a consultation booking succeeded during the call, else "no".
notes_from_call: anything specific (kitchen, wardrobes, style, possession date, rented or owned, complaint details), 1-2 sentences.`;

const outputSchema = z.object({
  fields: z.object(Object.fromEntries(FIELD_KEYS.map((k) => [k, z.string()])) as Record<(typeof FIELD_KEYS)[number], z.ZodString>),
  evidence: z.object(Object.fromEntries(CRITERIA.map((k) => [k, z.string()])) as Record<(typeof CRITERIA)[number], z.ZodString>),
  brief: z.object({
    caller_name: z.string(),
    property_type: z.string(),
    size: z.string(),
    location: z.string(),
    scope: z.string(),
    budget_stated: z.string(),
    timeline: z.string(),
    decision_maker: z.string(),
    language: z.string(),
    summary: z.string(),
  }),
  reason: z.string(),
});

export interface ExtractResult {
  fields: Record<(typeof FIELD_KEYS)[number], string>;
  evidence: Record<(typeof CRITERIA)[number], string>;
  brief: Brief;
  reason: string;
  inputTokens: number;
  outputTokens: number;
}

const ctx = (f: string) => readFileSync(join(process.cwd(), "context", f), "utf8");

function systemPrompt(callDateIst: string): string {
  return `You read phone-call transcripts for Aangan Studio, an interior design studio in Pune, and extract what the CALLER said.
You decide nothing: a rule engine applies the studio's rubric to your fields. Never invent facts; use "" for anything the caller did not say.

CALL DATE (today, IST): ${callDateIst}

FIELDS (all values are strings):
${FIELD_GUIDE}

EVIDENCE: for each rubric criterion (real_project, service_area, timeline, budget, decision_maker) copy an EXACT, verbatim quote of the CALLER's own words (never the agent's), character for character in the original language and script, that shows the answer. "" if the caller said nothing relevant.

BRIEF: for the designer who calls back. English, concrete, no prices. "summary" is 3-5 sentences. Use "not stated" for missing items.
REASON: 1-2 sentences on the overall picture for the founder.

=== SERVICES (context for extraction) ===
${ctx("services.md")}

=== RUBRIC (context for extraction) ===
${ctx("qualified.md")}`;
}

const S = { type: "STRING" };
const objOf = (keys: readonly string[]) => ({
  type: "OBJECT",
  properties: Object.fromEntries(keys.map((k) => [k, S])),
  required: [...keys],
});
const responseSchema = {
  type: "OBJECT",
  properties: {
    fields: objOf(FIELD_KEYS),
    evidence: objOf(CRITERIA),
    brief: objOf(["caller_name", "property_type", "size", "location", "scope", "budget_stated", "timeline", "decision_maker", "language", "summary"]),
    reason: S,
  },
  required: ["fields", "evidence", "brief", "reason"],
};

export async function extractCall(transcriptText: string, callDate: Date): Promise<ExtractResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const callDateIst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", weekday: "long" }).format(callDate);

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt(callDateIst) }] },
      contents: [{ role: "user", parts: [{ text: `TRANSCRIPT\n\n${transcriptText}` }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  const parsed = outputSchema.parse(JSON.parse(text));
  return {
    ...parsed,
    inputTokens: json?.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: (json?.usageMetadata?.candidatesTokenCount ?? 0) + (json?.usageMetadata?.thoughtsTokenCount ?? 0),
  };
}
