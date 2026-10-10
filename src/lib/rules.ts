// Deterministic lead rules. The AI only extracts what the caller said; these rules decide.
// Sources: qualified.md (five criteria), services.md (scope + area), pricing.md (used ONLY here,
// internally, to add a private note when a stated budget looks low; the voice agent never sees it).
//
// Studio policy (aligned with the team reference implementation, Oct 2026):
//  - The ONLY automatic decline is a site outside Pune / PCMC (declined politely on the call).
//  - Anything else that doesn't clearly fit goes to a person for review, never declined by the AI.
//  - Budget is asked on every call and recorded (HubSpot amount), but NEVER changes the outcome.
//  - Existing clients are escalated for a senior callback.
import type { Label } from "./types";

export type Tier = "BOOK" | "REVIEW" | "DECLINE_FACTUAL" | "ESCALATE";

export const TIER_TO_LABEL: Record<Tier, Label> = {
  BOOK: "qualified",
  REVIEW: "borderline",
  DECLINE_FACTUAL: "not_a_fit",
  ESCALATE: "escalate",
};

export interface LeadFields {
  caller_type: "new_enquiry" | "existing_client" | "other";
  name?: string;
  mobile?: string;
  email?: string;
  project_intent: "design_and_execution" | "advice_only" | "decor_only" | "furniture_only" | "vastu_only" | "unclear";
  property_category: "residential" | "office" | "clinic" | "studio" | "restaurant" | "hotel" | "retail" | "gym" | "other" | "unknown";
  location_text?: string;
  /** False when the location the AI extracted is not in the caller's own words (never decline on it). */
  location_verified?: boolean;
  carpet_area_sqft?: number | null;
  bhk?: number | null;
  scope_type?: "full_home" | "partial" | "single_room" | "commercial_fitout" | "unknown";
  rooms_count?: number | null;
  completion_text?: string;
  completion_needed_by?: string | null; // YYYY-MM-DD
  timeline_flexible?: boolean;
  budget_inr?: { min?: number; max: number } | null;
  budget_text?: string;
  decision_maker: "yes" | "authorised" | "unclear" | "no";
  structural_changes_requested?: boolean;
  consultation_booked?: boolean;
  notes_from_call?: string;
}

export type CriterionStatus = "pass" | "fail" | "unclear";

export interface RuleDecision {
  tier: Tier;
  label: Label;
  reasons: string[]; // why (dashboard/handoff only; never read to the caller)
  notes: string[]; // uncertainties for the designer
  criteria: Record<"real_project" | "service_area" | "timeline" | "budget" | "decision_maker", { status: CriterionStatus; note: string }>;
}

// ---- services.md --------------------------------------------------------
export const SERVICE_AREAS = [
  "kothrud", "baner", "aundh", "wakad", "koregaon park", "kalyani nagar", "viman nagar",
  "hadapsar", "magarpatta", "nibm", "kondhwa", "undri", "shivane", "warje", "erandwane", "deccan",
  "pimpri", "chinchwad", "pimple saudagar", "pimple nilakh", "ravet", "hinjewadi", "pcmc",
];
export const OUT_OF_AREA = [
  "talegaon", "lonavala", "nashik", "mumbai", "thane", "navi mumbai", "satara", "kolhapur", "nagpur", "aurangabad",
];
const OUT_OF_SCOPE_CATEGORIES = ["restaurant", "hotel", "retail", "gym"];
const COMMERCIAL = ["office", "clinic", "studio"];
const NOT_EXECUTION = ["advice_only", "decor_only", "furniture_only", "vastu_only"];

// ---- thresholds (proposals; confirm with Nikhil) ------------------------
export const TIMELINE_SHORT_WEEKS = 6; // services.md: can't be ready in under 6 weeks
export const TIMELINE_REVIEW_WEEKS = 10; // qualified.md: needs 8-10 weeks; under 10 -> a person judges
export const COMMERCIAL_MIN_SQFT = 500;
export const COMMERCIAL_MAX_SQFT = 3000; // services.md: up to ~3,000 sq ft
const BUDGET_LOW_NOTE = 0.8; // stated max < 80% of the lowest plausible cost -> private note

// ---- pricing.md (internal only, never sent to the agent or caller) -----
const RES_MIN_PER_SQFT = 1800;
const COMM_MIN_PER_SQFT = 1200;
const SINGLE_ROOM_MIN = 350000;

export function lowestPlausibleCost(f: LeadFields): number | null {
  if (COMMERCIAL.includes(f.property_category) && f.carpet_area_sqft) return f.carpet_area_sqft * COMM_MIN_PER_SQFT;
  if (f.property_category !== "residential") return null;
  if (f.scope_type === "single_room") return SINGLE_ROOM_MIN;
  if (f.scope_type === "partial" && f.rooms_count) return f.rooms_count * SINGLE_ROOM_MIN;
  if (f.carpet_area_sqft) return f.carpet_area_sqft * RES_MIN_PER_SQFT;
  return null;
}

export function areaStatus(loc?: string): "in" | "out" | "unknown" {
  if (!loc) return "unknown";
  const l = loc.toLowerCase();
  if (OUT_OF_AREA.some((a) => l.includes(a))) return "out";
  if (SERVICE_AREAS.some((a) => l.includes(a))) return "in";
  return "unknown"; // "Pune" alone, Kharadi, Nanded City -> a person checks
}

const weeksUntil = (iso: string, now: Date) => (new Date(iso).getTime() - now.getTime()) / (7 * 24 * 3600 * 1000);

export function decide(f: LeadFields, now: Date = new Date()): RuleDecision {
  const reasons: string[] = [];
  const notes: string[] = [];
  let review = false;
  const c: RuleDecision["criteria"] = {
    real_project: { status: "pass", note: "Wants design and execution" },
    service_area: { status: "pass", note: "" },
    timeline: { status: "pass", note: "" },
    budget: { status: "pass", note: "" },
    decision_maker: { status: "pass", note: "Caller decides" },
  };
  const out = (tier: Tier): RuleDecision => ({ tier, label: TIER_TO_LABEL[tier], reasons, notes, criteria: c });

  if (f.caller_type === "existing_client") {
    reasons.push("Existing client, not a new enquiry: senior callback within 15 minutes");
    return out("ESCALATE");
  }

  // Criterion 2: service area. The only automatic decline, and only on the caller's own words.
  const area = areaStatus(f.location_text);
  if (area === "out" && f.location_verified !== false) {
    c.service_area = { status: "fail", note: `${f.location_text} is outside Pune / PCMC` };
    reasons.push(`Criterion 2: ${f.location_text} is outside Pune / PCMC`);
    return out("DECLINE_FACTUAL");
  }
  if (area === "in") c.service_area.note = `${f.location_text} is in the service area`;
  else {
    c.service_area = { status: "unclear", note: `"${f.location_text ?? "not given"}" is not on the service-area list` };
    reasons.push(`Criterion 2: location "${f.location_text ?? "not given"}" not on the service-area list`);
    review = true;
  }

  // Criterion 1: real project (design + execution) and in scope.
  if (NOT_EXECUTION.includes(f.project_intent)) {
    c.real_project = { status: "fail", note: `${f.project_intent.replace("_", " ")}, not design + execution` };
    reasons.push(`Criterion 1: ${f.project_intent.replace("_", " ")}, not design + execution; a person decides`);
    review = true;
  } else if (f.project_intent === "unclear") {
    c.real_project = { status: "unclear", note: "Unclear whether they want execution" };
    reasons.push("Criterion 1: unclear whether they want execution");
    review = true;
  }
  if (OUT_OF_SCOPE_CATEGORIES.includes(f.property_category)) {
    c.real_project = { status: "fail", note: `${f.property_category} is outside our services` };
    reasons.push(`Scope: ${f.property_category} is outside our usual services; a person decides`);
    review = true;
  } else if (f.property_category === "other" || f.property_category === "unknown") {
    if (c.real_project.status === "pass") c.real_project = { status: "unclear", note: "Property type unclear" };
    reasons.push("Scope: property type unclear");
    review = true;
  }
  if (COMMERCIAL.includes(f.property_category) && f.carpet_area_sqft) {
    if (f.carpet_area_sqft < COMMERCIAL_MIN_SQFT || f.carpet_area_sqft > COMMERCIAL_MAX_SQFT) {
      const why =
        f.carpet_area_sqft < COMMERCIAL_MIN_SQFT
          ? `${f.carpet_area_sqft} sq ft is below the usual ${COMMERCIAL_MIN_SQFT} sq ft commercial minimum`
          : `${f.carpet_area_sqft} sq ft is above the ~${COMMERCIAL_MAX_SQFT} sq ft commercial limit`;
      c.real_project = { status: "unclear", note: why };
      reasons.push(`Scope: ${why}`);
      review = true;
    }
  }

  // Criterion 3: timeline.
  if (f.completion_needed_by) {
    const w = weeksUntil(f.completion_needed_by, now);
    if (w < TIMELINE_SHORT_WEEKS) {
      c.timeline = { status: "fail", note: `Needs completion in ${w.toFixed(1)} weeks (under ${TIMELINE_SHORT_WEEKS})` };
      reasons.push(`Criterion 3: needs completion in ${w.toFixed(1)} weeks, under our ${TIMELINE_SHORT_WEEKS}-week minimum; a person decides`);
      review = true;
    } else if (w < TIMELINE_REVIEW_WEEKS) {
      c.timeline = { status: "unclear", note: `Needs completion in ${w.toFixed(1)} weeks (tight)` };
      reasons.push(`Criterion 3: needs completion in ${w.toFixed(1)} weeks, tight; a person judges`);
      review = true;
    } else c.timeline.note = `Needs completion by ${f.completion_needed_by} (${w.toFixed(0)} weeks)`;
  } else if (f.timeline_flexible) {
    c.timeline.note = "Flexible timeline";
  } else {
    c.timeline = { status: "unclear", note: "Completion date not established" };
    reasons.push("Criterion 3: completion date not established");
    review = true;
  }

  // Criterion 4: budget. Recorded, NEVER changes the outcome; a low one is a private note.
  if (f.budget_inr?.max) {
    const floor = lowestPlausibleCost(f);
    const low = floor != null && f.budget_inr.max / floor < BUDGET_LOW_NOTE;
    c.budget = { status: "pass", note: `Stated: ${f.budget_text ?? f.budget_inr.max}` };
    if (low) notes.push("Stated budget looks low for the described scope; discuss at consultation");
  } else {
    c.budget = { status: "unclear", note: `Not given${f.budget_text ? ` ("${f.budget_text}")` : ""}` };
    notes.push(`Budget not given${f.budget_text ? ` ("${f.budget_text}")` : ""}`);
  }

  // Criterion 5: decision-maker. Unclear is still qualified, with a note.
  if (f.decision_maker === "authorised") c.decision_maker.note = "Deciding with someone who knows they called";
  if (f.decision_maker === "unclear") {
    c.decision_maker = { status: "unclear", note: "Not confirmed on the call" };
    notes.push("Decision-maker not confirmed on the call");
  }
  if (f.decision_maker === "no") {
    c.decision_maker = { status: "fail", note: "Researching for someone else, not authorised" };
    reasons.push("Criterion 5: caller is researching, not authorised to proceed");
    review = true;
  }

  if (f.structural_changes_requested) notes.push("Caller mentioned structural changes; we don't move walls");

  if (review) return out("REVIEW");
  reasons.push("Passes all five criteria");
  return out("BOOK");
}

// ---- normalising extracted values ----------------------------------------
const clean = (v: unknown) => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === "" || /^(null|none|n\/a|na|not (stated|given|mentioned|provided)|unknown|-)$/i.test(s) ? undefined : s;
};

/** "15 lakhs" -> 1500000, "1.2 cr" -> 12000000, "950" -> 950. */
export function parseAmount(v: unknown): number | null {
  const s = clean(v)?.toLowerCase().replace(/,/g, "");
  if (!s) return null;
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  let n = Number(m[0]);
  if (/crore|\bcr\b/.test(s)) n *= 1e7;
  else if (/lakh|lac|\bl\b/.test(s)) n *= 1e5;
  return Number.isFinite(n) ? n : null;
}

/** +91XXXXXXXXXX from whatever was said; undefined if it doesn't look like a phone number. */
export function normalisePhone(v: unknown): string | undefined {
  const d = (clean(v) ?? "").replace(/\D/g, "");
  if (d.length === 10) return `+91${d}`;
  if (d.length === 12 && d.startsWith("91")) return `+${d}`;
  if (d.length > 10 && d.length <= 15) return `+${d}`;
  return undefined;
}

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => {
  const s = clean(v)?.toLowerCase().replace(/[\s-]+/g, "_") as T | undefined;
  return s && allowed.includes(s) ? s : fallback;
};
const yes = (v: unknown) => v === true || /^(yes|true|y)$/i.test(clean(v) ?? "");

/** Raw extracted values (Gemini or Vaani entities, same keys) -> typed LeadFields. */
export function toLeadFields(e: Record<string, unknown>): LeadFields {
  const bMax = parseAmount(e.budget_max_inr);
  const bMin = parseAmount(e.budget_min_inr);
  const date = clean(e.completion_needed_by);
  const bhk = parseAmount(e.bhk);
  const scope = oneOf(e.scope_type, ["full_home", "partial", "single_room", "commercial_fitout", "unknown"] as const, "unknown");
  let category = oneOf(
    e.property_category,
    ["residential", "office", "clinic", "studio", "restaurant", "hotel", "retail", "gym", "other", "unknown"] as const,
    "unknown",
  );
  // "a 3 BHK" or a home scope means residential even if the type was left empty.
  if (category === "unknown" && (bhk || ["full_home", "partial", "single_room"].includes(scope))) category = "residential";
  return {
    caller_type: oneOf(e.caller_type, ["new_enquiry", "existing_client", "other"] as const, "new_enquiry"),
    name: clean(e.caller_name),
    mobile: normalisePhone(e.caller_mobile),
    email: clean(e.caller_email)?.toLowerCase(),
    project_intent: oneOf(
      e.project_intent,
      ["design_and_execution", "advice_only", "decor_only", "furniture_only", "vastu_only", "unclear"] as const,
      "unclear",
    ),
    property_category: category,
    location_text: clean(e.location_text),
    carpet_area_sqft: parseAmount(e.carpet_area_sqft),
    bhk,
    scope_type: scope,
    rooms_count: parseAmount(e.rooms_count),
    completion_text: clean(e.completion_text),
    completion_needed_by: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    timeline_flexible: yes(e.timeline_flexible),
    budget_inr: bMax ? { ...(bMin && bMin !== bMax ? { min: bMin } : {}), max: bMax } : null,
    budget_text: clean(e.budget_text),
    decision_maker: oneOf(e.decision_maker, ["yes", "authorised", "unclear", "no"] as const, "unclear"),
    structural_changes_requested: yes(e.structural_changes),
    consultation_booked: yes(e.consultation_booked),
    notes_from_call: clean(e.notes_from_call),
  };
}

/** What the agent says at the end, per tier (mirrored in the voice prompt). */
export const CLOSING_LINES = {
  book: "Our designer is free at the times I'm about to offer. Which one works best for you?",
  review:
    "Thank you for sharing all of this. For this request, I'll need to take it back to my team. One of our designers will review your details and connect with you.",
  escalate:
    "I'm sorry this has happened. I'm flagging it to our senior team right now, and someone senior will call you back within 15 minutes.",
  area: (place: string) =>
    `Thank you so much for calling Aangan Studio. Unfortunately we don't serve ${place} yet; we currently work only in Pune city and PCMC. If we start working in your area, we'll get back to you, but for now we won't be able to take this on. Thank you for thinking of us.`,
};
