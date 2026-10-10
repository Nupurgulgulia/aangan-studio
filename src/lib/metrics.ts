import { fixedMonthlyCostInr } from "./cost";
import { workingMinutesBetween } from "./hours";
import { STAGES, type CallRow, type Stage } from "./types";

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function pipelineMetrics(calls: CallRow[], now = new Date()) {
  const by = (l: string) => calls.filter((c) => c.label === l).length;
  const won = calls.filter((c) => c.stage === "won");
  const lost = calls.filter((c) => c.stage === "lost" && c.deal_value_inr != null);
  const sum = (cs: CallRow[]) => cs.reduce((a, c) => a + (c.deal_value_inr ?? 0), 0);

  const open = calls.filter((c) => c.status !== "closed" && c.label);
  const stageRows = STAGES.filter((s) => s !== "won" && s !== "lost").map((s: Stage) => {
    const inStage = open.filter((c) => c.stage === s);
    const ageDays = inStage.map((c) => (now.getTime() - new Date(c.stage_changed_at ?? c.created_at).getTime()) / 86_400_000);
    return { stage: s, count: inStage.length, medianDays: median(ageDays) };
  });

  const lostReasons = new Map<string, number>();
  for (const c of calls.filter((c) => c.stage === "lost")) {
    const r = (c.lost_reason ?? "no reason recorded").trim().toLowerCase();
    lostReasons.set(r, (lostReasons.get(r) ?? 0) + 1);
  }

  return {
    total: calls.length,
    qualified: by("qualified"),
    borderline: by("borderline"),
    notAFit: by("not_a_fit"),
    escalated: by("escalate"),
    wonCount: won.length,
    wonValue: sum(won),
    lostCount: calls.filter((c) => c.stage === "lost").length,
    lostValue: sum(lost),
    stageRows,
    lostReasons: [...lostReasons.entries()].sort((a, b) => b[1] - a[1]),
    designerRows: Object.entries(
      calls.filter((c) => c.designer_name).reduce<Record<string, CallRow[]>>((acc, c) => {
        (acc[c.designer_name!] ||= []).push(c);
        return acc;
      }, {}),
    ).map(([name, cs]) => ({
      name,
      received: cs.length,
      won: cs.filter((c) => c.stage === "won").length,
    })),
  };
}

export function opsMetrics(calls: CallRow[], now = new Date()) {
  const answered = calls.filter((c) => c.answered_after_sec != null).map((c) => c.answered_after_sec!);
  const afterHours = calls.filter((c) => c.after_hours).length;

  // "Unanswered at 48h" = nothing happened to the lead for 48h: still waiting on a human.
  const stale = calls.filter((c) => {
    const waiting = c.status === "in_review" || (c.status === "with_designer" && !c.accepted_at);
    return waiting && now.getTime() - new Date(c.created_at).getTime() > 48 * 3_600_000;
  }).length;

  const slaBreaches = calls.filter((c) => {
    if (c.status !== "with_designer" && c.status !== "closed") return false;
    if (!c.designer_name) return false;
    const end = c.accepted_at ? new Date(c.accepted_at) : now;
    return workingMinutesBetween(new Date(c.created_at), end) > 120;
  }).length;

  const vaani = calls.reduce((a, c) => a + Number(c.vaani_cost_inr ?? 0), 0);
  const ai = calls.reduce((a, c) => a + Number(c.ai_cost_inr ?? 0), 0);
  const total = vaani + ai + fixedMonthlyCostInr();
  const qualified = calls.filter((c) => c.label === "qualified").length;
  const bookings = calls.filter((c) => c.booking_start).length;
  const wonValue = calls.filter((c) => c.stage === "won").reduce((a, c) => a + (c.deal_value_inr ?? 0), 0);

  return {
    handled: calls.length,
    medianAnswerSec: median(answered),
    afterHoursShare: calls.length ? afterHours / calls.length : 0,
    unansweredAt48h: stale,
    unansweredAt48hShare: calls.length ? stale / calls.length : 0,
    slaBreaches,
    pricingFlags: calls.filter((c) => c.pricing_violation).length,
    scoringErrors: calls.filter((c) => (c as any).scoring_error).length,
    cost: {
      vaani,
      ai,
      fixed: fixedMonthlyCostInr(),
      total,
      perCall: calls.length ? total / calls.length : 0,
      perQualified: qualified ? total / qualified : null,
      perBooking: bookings ? total / bookings : null,
      roi: total > 0 && wonValue > 0 ? wonValue / total : null,
    },
  };
}

export const inr = (n: number | null | undefined) =>
  n == null ? "n/a" : "₹" + Math.round(n).toLocaleString("en-IN");
