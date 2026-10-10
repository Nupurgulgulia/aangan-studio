import { CRITERIA, type Criteria, type CriterionResult, type Label, type Turn } from "./types";

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/** True if `quote` appears verbatim (ignoring case/whitespace) in something the caller said. */
export function quoteIsInCallerSpeech(quote: string, turns: Turn[]): boolean {
  const q = norm(quote).replace(/^[.…\s]+|[.…\s]+$/g, "");
  if (!q) return false;
  return turns.some((t) => t.speaker === "caller" && norm(t.text).includes(q));
}

/**
 * The model never rejects anyone on an invented quote. Anything it cannot back with
 * the caller's own words is downgraded to "unclear", which routes to a human.
 */
export function verifyEvidence(criteria: Criteria, turns: Turn[]): Criteria {
  const out = {} as Criteria;
  for (const key of CRITERIA) {
    const c: CriterionResult = { ...criteria[key] };
    const hasQuote = c.evidence_quote.trim().length > 0;
    if (hasQuote && !quoteIsInCallerSpeech(c.evidence_quote, turns)) {
      c.status = "unclear";
      c.note = `${c.note} [evidence quote not found in transcript; downgraded to unclear]`.trim();
      c.evidence_quote = "";
    } else if (!hasQuote && c.status === "fail") {
      c.status = "unclear";
      c.note = `${c.note} [no supporting quote; downgraded to unclear]`.trim();
    } else if (!hasQuote && c.status === "pass" && key !== "budget" && key !== "decision_maker") {
      c.status = "unclear";
      c.note = `${c.note} [no supporting quote; downgraded to unclear]`.trim();
    }
    out[key] = c;
  }
  return out;
}

export interface Decision {
  label: Label;
  uncertainty: string[];
  failed: string[];
}

/**
 * Applies qualified.md deterministically:
 *  - two or more fails            -> not_a_fit
 *  - one fail                     -> borderline (never forwarded; front desk checks)
 *  - criteria 1-3 still unclear   -> borderline
 *  - criteria 4-5 unclear         -> qualified, uncertainty noted in handoff
 *  - budget not mentioned         -> qualified
 */
export function decide(criteria: Criteria): Decision {
  const failed = CRITERIA.filter((k) => criteria[k].status === "fail");
  const uncertainty: string[] = [];

  for (const k of ["budget", "decision_maker"] as const) {
    if (criteria[k].status === "unclear") {
      uncertainty.push(
        k === "budget"
          ? "Budget not stated; designer to establish at consultation."
          : "Decision-maker not confirmed; confirm authority on first call.",
      );
    }
  }

  if (failed.length >= 2) return { label: "not_a_fit", uncertainty, failed };
  if (failed.length === 1) return { label: "borderline", uncertainty, failed };

  const unclearCore = (["real_project", "service_area", "timeline"] as const).filter(
    (k) => criteria[k].status === "unclear",
  );
  if (unclearCore.length > 0) {
    return {
      label: "borderline",
      uncertainty: [...uncertainty, ...unclearCore.map((k) => `${k} still unclear after the call.`)],
      failed,
    };
  }
  return { label: "qualified", uncertainty, failed };
}
