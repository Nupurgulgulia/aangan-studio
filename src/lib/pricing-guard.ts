import type { Turn } from "./types";

// Phrases that are a quote no matter what number is attached.
const QUOTE_PHRASES = [
  /per\s*(square\s*)?(sq\.?\s*)?(f(oo|ee)?t)\b/i,
  /\/\s*sq\.?\s*ft/i,
  /rates?\s+(start|begin)/i,
  /(starts?|starting)\s+(at|from)/i,
  /(it'?ll|it\s+will|would|typically|usually|roughly|around|approximately)\s+(cost|be)\b.{0,40}(\d|lakh|lac|crore|₹|rs)/i,
  /प्रति\s*(स्क्वे(य|)र\s*)?फ(ु|ू)ट/,
];

const CURRENCY_NUMBER =
  /(?:₹|rs\.?|inr|rupees?|रुपय(?:े|ा|ों)|रुपए)\s*[\d,.]+|[\d,.]+\s*(?:lakhs?|lacs?|crores?|लाख|करोड़|rupees?|रुपय(?:े|ा|ों)|रुपए|k\b)/gi;

const digitsOf = (s: string) => s.replace(/[^\d.]/g, "");

export interface PricingCheck {
  violated: boolean;
  offending: string[];
}

/**
 * Scans what the AI said. Phrases like "per sq ft" or "rates start at" always flag.
 * A currency amount flags only if the caller did not say that number first
 * (the agent may legitimately repeat a budget the caller volunteered).
 */
export function checkAgentForPriceQuote(turns: Turn[]): PricingCheck {
  const callerNumbers = new Set<string>();
  for (const t of turns) {
    if (t.speaker !== "caller") continue;
    for (const m of t.text.matchAll(CURRENCY_NUMBER)) callerNumbers.add(digitsOf(m[0]));
    for (const m of t.text.matchAll(/\b\d[\d,.]*\b/g)) callerNumbers.add(digitsOf(m[0]));
  }

  const offending: string[] = [];
  for (const t of turns) {
    if (t.speaker !== "agent") continue;
    if (QUOTE_PHRASES.some((re) => re.test(t.text))) {
      offending.push(t.text);
      continue;
    }
    for (const m of t.text.matchAll(CURRENCY_NUMBER)) {
      if (!callerNumbers.has(digitsOf(m[0]))) {
        offending.push(t.text);
        break;
      }
    }
  }
  return { violated: offending.length > 0, offending };
}
