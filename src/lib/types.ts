export const CRITERIA = [
  "real_project",
  "service_area",
  "timeline",
  "budget",
  "decision_maker",
] as const;
export type Criterion = (typeof CRITERIA)[number];

export const CRITERION_LABELS: Record<Criterion, string> = {
  real_project: "1. Real project, not just advice",
  service_area: "2. In our service area (Pune / PCMC)",
  timeline: "3. Realistic timeline",
  budget: "4. Right budget band (broadly)",
  decision_maker: "5. Decision-maker on the call",
};

export type CriterionStatus = "pass" | "fail" | "unclear";
export type Label = "qualified" | "borderline" | "not_a_fit" | "escalate";

export interface CriterionResult {
  status: CriterionStatus;
  /** Verbatim caller words supporting the status; empty if none. */
  evidence_quote: string;
  note: string;
}
export type Criteria = Record<Criterion, CriterionResult>;

export interface Brief {
  caller_name: string;
  property_type: string;
  size: string;
  location: string;
  scope: string;
  budget_stated: string;
  timeline: string;
  decision_maker: string;
  language: string;
  summary: string;
}

export interface Turn {
  speaker: "caller" | "agent";
  text: string;
}

export type Stage = "new" | "accepted" | "called" | "proposal" | "won" | "lost";
export const STAGES: Stage[] = ["new", "accepted", "called", "proposal", "won", "lost"];

export type Status =
  | "received"
  | "with_designer" // qualified, emailed to a designer
  | "in_review" // borderline / not a fit, waiting for the front desk
  | "closed"; // front desk closed it, or won/lost

export interface CallRow {
  id: string;
  vaani_call_id: string;
  caller_number: string | null;
  caller_name: string | null;
  started_at: string;
  duration_sec: number | null;
  answered_after_sec: number | null;
  after_hours: boolean;
  answer_trigger: string | null;
  transcript: string | null;
  label: Label | null;
  reason: string | null;
  criteria: Criteria | null;
  brief: Brief | null;
  uncertainty: string[] | null;
  /** Extracted answers (LeadFields) and the rule reasons behind the label. */
  fields: Record<string, unknown> | null;
  reasons: string[] | null;
  caller_email: string | null;
  pricing_violation: boolean;
  pricing_violation_text: string | null;
  status: Status;
  designer_name: string | null;
  designer_email: string | null;
  booking_start: string | null;
  booking_url: string | null;
  stage: Stage;
  stage_changed_at: string | null;
  accepted_at: string | null;
  deal_value_inr: number | null;
  lost_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  reminded_at: string | null;
  hubspot_deal_id: string | null;
  hubspot_error: string | null;
  email_error: string | null;
  scoring_error: string | null;
  vaani_cost_inr: number;
  ai_cost_inr: number;
  created_at: string;
}
