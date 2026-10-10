import { describe, expect, it } from "vitest";
import { checkAgentForPriceQuote } from "../src/lib/pricing-guard";
import { parseTranscript } from "../src/lib/transcript";

const t = (s: string) => parseTranscript(s);

describe("pricing guard", () => {
  it("passes the approved deflection line", () => {
    const r = checkAgentForPriceQuote(
      t(`Caller: How much for a 2BHK?
Agent: Pricing depends on the site, the materials you choose, and the scope. Your designer will walk you through it in detail at the consultation.`),
    );
    expect(r.violated).toBe(false);
  });

  it("flags per-sq-ft figures", () => {
    expect(checkAgentForPriceQuote(t("Caller: rate?\nAgent: Our rates are about 2,000 per sq ft.")).violated).toBe(true);
  });

  it("flags 'it'll cost around'", () => {
    expect(checkAgentForPriceQuote(t("Caller: cost?\nAgent: It'll cost around 12 lakh.")).violated).toBe(true);
  });

  it("flags 'rates start at' even without a number", () => {
    expect(checkAgentForPriceQuote(t("Caller: cost?\nAgent: Our rates start at a very reasonable level.")).violated).toBe(true);
  });

  it("flags a new rupee amount the caller never said", () => {
    expect(checkAgentForPriceQuote(t("Caller: ok\nAgent: Projects like that run ₹25 lakh.")).violated).toBe(true);
  });

  it("allows repeating a budget the caller volunteered", () => {
    const r = checkAgentForPriceQuote(
      t("Caller: My budget is 5 lakh.\nAgent: Thanks, you mentioned 5 lakh. Your designer will go through it with you."),
    );
    expect(r.violated).toBe(false);
  });

  it("allows repeating the property size", () => {
    expect(checkAgentForPriceQuote(t("Caller: It's 1200 sq ft.\nAgent: Got it, 1200 sq ft in Baner.")).violated).toBe(false);
  });

  it("flags Hindi rupee amounts", () => {
    expect(checkAgentForPriceQuote(t("Caller: kitna?\nAgent: Lagbhag 15 लाख रुपये lagenge.")).violated).toBe(true);
  });
});

describe("transcript parsing", () => {
  it("parses array transcripts and role names", () => {
    const turns = parseTranscript([
      { role: "assistant", text: "Hello" },
      { role: "user", text: "Hi" },
    ]);
    expect(turns).toEqual([
      { speaker: "agent", text: "Hello" },
      { speaker: "caller", text: "Hi" },
    ]);
  });

  it("joins wrapped lines onto the previous turn", () => {
    const turns = parseTranscript("Caller: I want to\nredo my flat");
    expect(turns[0].text).toBe("I want to redo my flat");
  });
});
