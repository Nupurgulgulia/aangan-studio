import { describe, expect, it } from "vitest";
import { decide, quoteIsInCallerSpeech, verifyEvidence } from "../src/lib/rubric";
import { CRITERIA, type Criteria, type CriterionStatus, type Turn } from "../src/lib/types";

const mk = (over: Partial<Record<(typeof CRITERIA)[number], CriterionStatus>> = {}): Criteria =>
  Object.fromEntries(
    CRITERIA.map((k) => [k, { status: over[k] ?? "pass", evidence_quote: "", note: "" }]),
  ) as Criteria;

describe("decide (qualified.md rules)", () => {
  it("all pass -> qualified", () => expect(decide(mk()).label).toBe("qualified"));

  it("one fail -> borderline, never forwarded", () => {
    const d = decide(mk({ service_area: "fail" }));
    expect(d.label).toBe("borderline");
    expect(d.failed).toEqual(["service_area"]);
  });

  it("two fails -> not_a_fit", () => expect(decide(mk({ service_area: "fail", timeline: "fail" })).label).toBe("not_a_fit"));

  it("budget unclear (not mentioned) -> still qualified, uncertainty noted", () => {
    const d = decide(mk({ budget: "unclear" }));
    expect(d.label).toBe("qualified");
    expect(d.uncertainty.join(" ")).toMatch(/Budget/);
  });

  it("decision-maker unclear -> qualified with a note", () => {
    const d = decide(mk({ decision_maker: "unclear" }));
    expect(d.label).toBe("qualified");
    expect(d.uncertainty.length).toBe(1);
  });

  it("core criterion still unclear -> borderline", () => {
    for (const k of ["real_project", "service_area", "timeline"] as const) {
      expect(decide(mk({ [k]: "unclear" })).label).toBe("borderline");
    }
  });

  it("one fail plus unclear budget stays borderline", () =>
    expect(decide(mk({ timeline: "fail", budget: "unclear" })).label).toBe("borderline"));
});

describe("verifyEvidence (no rejection on an invented quote)", () => {
  const turns: Turn[] = [
    { speaker: "agent", text: "Where is the property?" },
    { speaker: "caller", text: "It's a flat in Talegaon, about 1200 sq ft." },
  ];

  it("keeps a fail whose quote is verbatim caller speech", () => {
    const c = mk({ service_area: "fail" });
    c.service_area.evidence_quote = "a flat in Talegaon";
    expect(verifyEvidence(c, turns).service_area.status).toBe("fail");
  });

  it("downgrades a fail with a made-up quote", () => {
    const c = mk({ service_area: "fail" });
    c.service_area.evidence_quote = "I live in Mumbai";
    expect(verifyEvidence(c, turns).service_area.status).toBe("unclear");
  });

  it("downgrades a fail with no quote", () => expect(verifyEvidence(mk({ timeline: "fail" }), turns).timeline.status).toBe("unclear"));

  it("does not accept a quote that only the agent said", () => {
    const c = mk({ service_area: "fail" });
    c.service_area.evidence_quote = "Where is the property";
    expect(verifyEvidence(c, turns).service_area.status).toBe("unclear");
  });

  it("a pass on a core criterion with no quote becomes unclear", () =>
    expect(verifyEvidence(mk(), turns).real_project.status).toBe("unclear"));

  it("a pass on budget/decision-maker without a quote is allowed", () => {
    const v = verifyEvidence(mk(), turns);
    expect(v.budget.status).toBe("pass");
    expect(v.decision_maker.status).toBe("pass");
  });

  it("quote matching ignores case and whitespace", () =>
    expect(quoteIsInCallerSpeech("ABOUT  1200 sq ft", turns)).toBe(true));
});
