import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizePayload } from "../src/lib/pipeline";
import { parseTranscript } from "../src/lib/transcript";

const events = JSON.parse(readFileSync("fixtures/vaani-events.json", "utf8"));
const post = events.find((e: any) => e.event === "call_postprocessing");

describe("Vaani call_postprocessing payload", () => {
  it("reads id, duration (ms -> s) and transcript from data", () => {
    const n = normalizePayload(post);
    expect(n.vaaniCallId).toBe("inbound-demo-vaani-004");
    expect(n.durationSec).toBe(188);
    expect(n.callerNumber).toBeNull();
    expect(new Date(post.timestamp).getTime() - n.startedAt.getTime()).toBe(188_000);
  });

  it("picks up the booking from extracted entities", () => {
    expect(normalizePayload(post).bookingStart).toBe("2026-10-13T05:30:00.000Z");
  });

  it("ignores a booking that wasn't confirmed or has no valid time", () => {
    const p = structuredClone(post);
    p.data.entities = { consultation_booked: "no", consultation_time: "2026-10-13T11:00:00+05:30" };
    expect(normalizePayload(p).bookingStart).toBeNull();
    p.data.entities = { consultation_booked: "yes", consultation_time: "Monday morning" };
    expect(normalizePayload(p).bookingStart).toBeNull();
  });
});

describe("Vaani transcript format", () => {
  it("parses [HH:MM:SS] AGENT/USER lines separated by blank lines", () => {
    const turns = parseTranscript(post.data.transcript);
    expect(turns[0]).toEqual({ speaker: "agent", text: expect.stringMatching(/^Namaste/) });
    expect(turns[1].speaker).toBe("caller");
    expect(turns[1].text).toMatch(/^Haan, I'm Rohan Mehta/);
    expect(turns.filter((t) => t.speaker === "caller")).toHaveLength(5);
  });

  it("parses the call-details format without timestamps", () => {
    expect(parseTranscript("AGENT: Hi\n\nUSER: Hello")).toEqual([
      { speaker: "agent", text: "Hi" },
      { speaker: "caller", text: "Hello" },
    ]);
  });
});

describe("unusable payloads are rejected as bad requests (400), not retried", () => {
  it("throws BadPayloadError when there is no call id", async () => {
    const { BadPayloadError } = await import("../src/lib/pipeline");
    expect(() => normalizePayload({ event: "call_postprocessing", data: {} })).toThrow(BadPayloadError);
    expect(() => normalizePayload({ transcript: "Caller: hi" })).toThrow(BadPayloadError);
  });
});
