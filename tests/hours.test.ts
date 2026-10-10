import { describe, expect, it } from "vitest";
import { isAfterHours, workingMinutesBetween } from "../src/lib/hours";

// 2026-10-07 is a Wednesday. IST = UTC+5:30.
const ist = (s: string) => new Date(`${s}+05:30`);

describe("working hours (IST, 10-19, Mon-Sat)", () => {
  it("flags evening and early-morning calls as after hours", () => {
    expect(isAfterHours(ist("2026-10-07T21:30:00"))).toBe(true);
    expect(isAfterHours(ist("2026-10-07T08:00:00"))).toBe(true);
  });
  it("treats midday as in hours", () => expect(isAfterHours(ist("2026-10-07T12:00:00"))).toBe(false));
  it("treats Sunday as after hours (assumption: Mon-Sat)", () => expect(isAfterHours(ist("2026-10-11T12:00:00"))).toBe(true));

  it("counts only working minutes", () => {
    // Wed 18:00 -> Thu 11:00 = 60 min (18-19) + 60 min (10-11)
    expect(workingMinutesBetween(ist("2026-10-07T18:00:00"), ist("2026-10-08T11:00:00"))).toBe(120);
  });
});
