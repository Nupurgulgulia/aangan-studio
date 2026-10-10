import type { Turn } from "./types";

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

