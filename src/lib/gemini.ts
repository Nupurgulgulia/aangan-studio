import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { CRITERIA, type Brief, type Criteria } from "./types";

const criterionSchema = z.object({
  status: z.enum(["pass", "fail", "unclear"]),
  evidence_quote: z.string(),
  note: z.string(),
});

const outputSchema = z.object({
  criteria: z.object(
    Object.fromEntries(CRITERIA.map((k) => [k, criterionSchema])) as Record<
      (typeof CRITERIA)[number],
      typeof criterionSchema
    >,
  ),
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

export interface ScoreResult {
  criteria: Criteria;
  brief: Brief;
  reason: string;
  inputTokens: number;
  outputTokens: number;
}

const ctx = (f: string) => readFileSync(join(process.cwd(), "context", f), "utf8");

function systemPrompt(): string {
  // pricing.md is deliberately NOT loaded: the scorer has no use for it.
  return `You score phone enquiries for Aangan Studio, an interior design studio in Pune.
You do NOT decide whether to reject anyone. You only judge each of five criteria from the transcript, using the studio's own rubric below. A separate rule engine turns your judgments into a label.

For each criterion return:
- status: "pass", "fail" or "unclear"
- evidence_quote: an EXACT, verbatim quote of the CALLER's words (never the agent's) that supports the status. Copy it character for character from the transcript, in the original language and script. Use "" if the caller said nothing relevant.
- note: one short sentence of reasoning.

Rules:
- "fail" requires a verbatim caller quote. Without one, use "unclear".
- Criterion 1 (real_project) also covers SCOPE from the services file: it FAILS if the work is something the studio does not do, even inside Pune with a good timeline: architecture/structural work (moving walls, permits), decor or styling advice only, standalone furniture sourcing, Vastu consultation only, restaurants/hotels/retail stores/gyms, or offices clearly over about 3,000 sq ft. A rented flat or a single room with full execution is in scope.
- Budget: if the caller never stated a number, status is "unclear" with an empty quote. Only "fail" if they volunteered a number clearly below what their described scope would cost.
- Decision-maker: "unclear" if never confirmed. "fail" only if they say they are just researching for someone else without authority.
- Never invent facts. If the caller did not say something, write "not stated" in the brief field.
- The brief is for a designer who will call back: be concrete, 3-5 sentences in "summary", English, no pricing.
- "reason" is 1-2 sentences explaining the overall picture for the founder.

=== SERVICES (what the studio does and does not do) ===
${ctx("services.md")}

=== NIKHIL'S RUBRIC (qualified.md) ===
${ctx("qualified.md")}`;
}

const stringProp = { type: "STRING" };
const criterionProp = {
  type: "OBJECT",
  properties: { status: { type: "STRING", enum: ["pass", "fail", "unclear"] }, evidence_quote: stringProp, note: stringProp },
  required: ["status", "evidence_quote", "note"],
};
const responseSchema = {
  type: "OBJECT",
  properties: {
    criteria: {
      type: "OBJECT",
      properties: Object.fromEntries(CRITERIA.map((k) => [k, criterionProp])),
      required: [...CRITERIA],
    },
    brief: {
      type: "OBJECT",
      properties: Object.fromEntries(
        [
          "caller_name",
          "property_type",
          "size",
          "location",
          "scope",
          "budget_stated",
          "timeline",
          "decision_maker",
          "language",
          "summary",
        ].map((k) => [k, stringProp]),
      ),
      required: [
        "caller_name",
        "property_type",
        "size",
        "location",
        "scope",
        "budget_stated",
        "timeline",
        "decision_maker",
        "language",
        "summary",
      ],
    },
    reason: stringProp,
  },
  required: ["criteria", "brief", "reason"],
};

export async function scoreTranscript(transcriptText: string): Promise<ScoreResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt() }] },
        contents: [{ role: "user", parts: [{ text: `TRANSCRIPT\n\n${transcriptText}` }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  const parsed = outputSchema.parse(JSON.parse(text));
  return {
    criteria: parsed.criteria,
    brief: parsed.brief,
    reason: parsed.reason,
    inputTokens: json?.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: (json?.usageMetadata?.candidatesTokenCount ?? 0) + (json?.usageMetadata?.thoughtsTokenCount ?? 0),
  };
}
