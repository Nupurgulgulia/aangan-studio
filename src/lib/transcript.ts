import type { Turn } from "./types";

/**
 * Accepts either an array of {role|speaker, text|content|message} or a plain
 * string with lines like "Agent: ..." / "Caller: ...". Vaani sends one string
 * of lines like "[00:00:03] AGENT: ..." / "[00:00:07] USER: ...", blank-line separated.
 */
export function parseTranscript(raw: unknown): Turn[] {
  if (Array.isArray(raw)) {
    return raw
      .map((r: any): Turn | null => {
        const who = String(r.role ?? r.speaker ?? "").toLowerCase();
        const text = String(r.text ?? r.content ?? r.message ?? "").trim();
        if (!text) return null;
        const speaker = /agent|assistant|bot|ai/.test(who) ? "agent" : "caller";
        return { speaker, text };
      })
      .filter((t): t is Turn => t !== null);
  }
  if (typeof raw === "string") {
    const turns: Turn[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:\[[\d:.]+\]\s*)?(agent|assistant|bot|ai|caller|user|customer)\s*[:\-]\s*(.+)$/i);
      if (m) {
        turns.push({
          speaker: /agent|assistant|bot|ai/i.test(m[1]) ? "agent" : "caller",
          text: m[2].trim(),
        });
      } else if (line.trim() && turns.length) {
        turns[turns.length - 1].text += " " + line.trim();
      }
    }
    return turns;
  }
  return [];
}

export const turnsToText = (turns: Turn[]) =>
  turns.map((t) => `${t.speaker === "agent" ? "Agent" : "Caller"}: ${t.text}`).join("\n");

/** A call with fewer than this many caller turns cannot be scored; it goes to the front desk for a callback. */
export const MIN_CALLER_TURNS = 2;
