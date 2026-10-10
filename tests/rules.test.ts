import { describe, expect, it } from "vitest";
import { quoteIsInCallerSpeech } from "../src/lib/rubric";
import { decide, normalisePhone, parseAmount, toLeadFields, type LeadFields, type Tier } from "../src/lib/rules";
import type { Turn } from "../src/lib/types";

// The case's September 2026 phone transcripts (Aangan_Sep_2026_Enquiries), encoded as the fields the
// agent extracts, with the outcome the studio policy expects (same set as the team reference repo).
type Case = { id: string; date: string; expect: Tier; f: LeadFields };
const base = { caller_type: "new_enquiry", project_intent: "design_and_execution", decision_maker: "yes" } as const;
const cases: Case[] = [
  { id: "T01 Priya, Kothrud 3BHK, March", date: "2026-09-02", expect: "BOOK", f: { ...base, property_category: "residential", location_text: "Kothrud, Dahanukar Colony", carpet_area_sqft: 1400, bhk: 3, scope_type: "full_home", completion_needed_by: "2027-03-31" } },
  { id: "T02 Wakad 2BHK, moving in November", date: "2026-09-03", expect: "REVIEW", f: { ...base, property_category: "residential", location_text: "Wakad", carpet_area_sqft: 950, bhk: 2, scope_type: "full_home", completion_needed_by: "2026-11-01" } },
  { id: "T03 Nashik home office", date: "2026-09-03", expect: "DECLINE_FACTUAL", f: { ...base, property_category: "residential", location_text: "Nashik", scope_type: "partial", rooms_count: 2, timeline_flexible: true } },
  { id: "T04 living room ideas only", date: "2026-09-04", expect: "REVIEW", f: { ...base, project_intent: "advice_only", property_category: "residential", location_text: "unknown", timeline_flexible: true } },
  { id: "T05 Aarti, Koregaon Park 4BHK, Feb", date: "2026-09-05", expect: "BOOK", f: { ...base, property_category: "residential", location_text: "Koregaon Park", carpet_area_sqft: 2400, bhk: 4, scope_type: "full_home", completion_needed_by: "2027-02-01" } },
  { id: "T06 Baner startup office 800 sq ft, Dec", date: "2026-09-05", expect: "BOOK", f: { ...base, property_category: "office", location_text: "Baner", carpet_area_sqft: 800, scope_type: "commercial_fitout", completion_needed_by: "2026-12-01" } },
  { id: "T07 before Diwali (3 weeks)", date: "2026-09-08", expect: "REVIEW", f: { ...base, property_category: "residential", location_text: "Pune", scope_type: "partial", rooms_count: 2, completion_needed_by: "2026-09-29" } },
  { id: "T09 existing client complaint", date: "2026-09-10", expect: "ESCALATE", f: { ...base, caller_type: "existing_client", property_category: "residential", location_text: "Viman Nagar" } },
  { id: "T10 Kharadi 1BHK, Rs 1-1.5L", date: "2026-09-11", expect: "REVIEW", f: { ...base, property_category: "residential", location_text: "Kharadi", carpet_area_sqft: 550, bhk: 1, scope_type: "partial", rooms_count: 2, timeline_flexible: true, budget_inr: { min: 100000, max: 150000 } } },
  { id: "T11 rented Baner 2BHK", date: "2026-09-12", expect: "BOOK", f: { ...base, property_category: "residential", location_text: "Baner", bhk: 2, scope_type: "partial", rooms_count: 3, timeline_flexible: true } },
  { id: "T12 Kalyani Nagar villa 5,500 sq ft", date: "2026-09-15", expect: "BOOK", f: { ...base, property_category: "residential", location_text: "Kalyani Nagar", carpet_area_sqft: 5500, scope_type: "full_home", completion_needed_by: "2027-03-01" } },
  { id: "T13 Aundh 3BHK, pushes for price", date: "2026-09-16", expect: "BOOK", f: { ...base, property_category: "residential", location_text: "Aundh", carpet_area_sqft: 1100, bhk: 3, scope_type: "partial", rooms_count: 4, timeline_flexible: true } },
  { id: "T14 son calling for parents, Hadapsar", date: "2026-09-17", expect: "BOOK", f: { ...base, property_category: "residential", location_text: "Hadapsar", bhk: 3, scope_type: "full_home", timeline_flexible: true, decision_maker: "unclear" } },
  { id: "T15 Smita, Undri, possession in 6 weeks", date: "2026-09-18", expect: "BOOK", f: { ...base, property_category: "residential", location_text: "Undri", carpet_area_sqft: 875, bhk: 2, scope_type: "full_home", timeline_flexible: true } },
  { id: "T16 Girish, Viman Nagar (repeat caller)", date: "2026-09-19", expect: "BOOK", f: { ...base, property_category: "residential", location_text: "Viman Nagar", bhk: 3, scope_type: "full_home", timeline_flexible: true } },
  { id: "T17 Ritu, Pimple Saudagar, March", date: "2026-09-22", expect: "BOOK", f: { ...base, property_category: "residential", location_text: "Pimple Saudagar", carpet_area_sqft: 1050, bhk: 3, scope_type: "full_home", completion_needed_by: "2027-03-31" } },
  { id: "T18 coworking pod 180 sq ft", date: "2026-09-23", expect: "REVIEW", f: { ...base, property_category: "office", location_text: "Pune", carpet_area_sqft: 180, scope_type: "commercial_fitout", timeline_flexible: true } },
  { id: "T19 restaurant, Koregaon Park", date: "2026-09-24", expect: "REVIEW", f: { ...base, property_category: "restaurant", location_text: "Koregaon Park", timeline_flexible: true } },
  { id: "T20 Pooja, Magarpatta 2BHK, Jan start", date: "2026-09-25", expect: "BOOK", f: { ...base, property_category: "residential", location_text: "Magarpatta", carpet_area_sqft: 900, bhk: 2, scope_type: "full_home", timeline_flexible: true } },
];
const at = (d: string) => new Date(`${d}T12:00:00+05:30`);

describe("September transcripts classify as the studio policy expects", () => {
  for (const c of cases) it(c.id, () => expect(decide(c.f, at(c.date)).tier).toBe(c.expect));
});

describe("studio policy", () => {
  it("budget never changes the outcome (tiny, huge and no budget on every transcript)", () => {
    for (const c of cases)
      for (const budget_inr of [{ max: 10000 }, { min: 5e7, max: 1e8 }, null])
        expect(decide({ ...c.f, budget_inr }, at(c.date)).tier).toBe(c.expect);
  });

  it("a low budget is a private note for the designer, still BOOK", () => {
    const d = decide({ ...cases[0].f, budget_inr: { max: 500000 } }, at("2026-09-02"));
    expect(d.tier).toBe("BOOK");
    expect(d.notes.join(" ")).toMatch(/budget looks low/);
  });

  it("out of area is the only automatic decline", () => {
    const d = decide({ ...cases[0].f, location_text: "Talegaon" }, at("2026-09-02"));
    expect(d.tier).toBe("DECLINE_FACTUAL");
    expect(d.label).toBe("not_a_fit");
  });

  it("never declines on a place the caller did not actually say", () => {
    const d = decide({ ...cases[0].f, location_text: "Mumbai", location_verified: false }, at("2026-09-02"));
    expect(d.tier).toBe("REVIEW");
  });

  it("advice-only, restaurants, tight timelines and researchers go to review, not decline", () => {
    for (const c of cases.filter((x) => x.expect === "REVIEW")) expect(decide(c.f, at(c.date)).label).toBe("borderline");
  });

  it("existing clients are escalated", () => {
    expect(decide(cases.find((c) => c.expect === "ESCALATE")!.f, at("2026-09-10")).label).toBe("escalate");
  });

  it("unclear decision-maker stays qualified with a note", () => {
    const d = decide(cases.find((c) => c.id.startsWith("T14"))!.f, at("2026-09-17"));
    expect(d.tier).toBe("BOOK");
    expect(d.notes.join(" ")).toMatch(/Decision-maker/);
  });
});

describe("extraction normalising", () => {
  it("parses lakhs/crores and phone numbers", () => {
    expect(parseAmount("15 lakhs")).toBe(1500000);
    expect(parseAmount("1.2 cr")).toBe(12000000);
    expect(parseAmount("1,050")).toBe(1050);
    expect(parseAmount("not stated")).toBeNull();
    expect(normalisePhone("98765 43210")).toBe("+919876543210");
    expect(normalisePhone("919876543210")).toBe("+919876543210");
    expect(normalisePhone("browser test call")).toBeUndefined();
  });

  it("maps raw extracted strings to typed fields", () => {
    const f = toLeadFields({
      caller_name: "Anita", caller_mobile: "9800000006", project_intent: "design and execution",
      property_category: "", bhk: "2", scope_type: "full_home", location_text: "Aundh",
      budget_text: "15 to 18 lakhs", budget_min_inr: "1500000", budget_max_inr: "18 lakh",
      timeline_flexible: "yes", decision_maker: "yes", consultation_booked: "no",
    });
    expect(f.property_category).toBe("residential"); // inferred from BHK
    expect(f.mobile).toBe("+919800000006");
    expect(f.budget_inr).toEqual({ min: 1500000, max: 1800000 });
    expect(f.project_intent).toBe("design_and_execution");
    expect(f.timeline_flexible).toBe(true);
  });
});

describe("verbatim caller quotes", () => {
  const turns: Turn[] = [
    { speaker: "agent", text: "Where is the property?" },
    { speaker: "caller", text: "It's a flat in Talegaon, about 1200 sq ft." },
  ];
  it("matches caller speech ignoring case and spacing", () => expect(quoteIsInCallerSpeech("about  1200 SQ FT", turns)).toBe(true));
  it("does not accept words only the agent said", () => expect(quoteIsInCallerSpeech("Where is the property", turns)).toBe(false));
});
