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

describe("lifecycle event call id", () => {
  it("finds the id at the top level or nested under data", async () => {
    const { flatEventCallId } = await import("../src/lib/pipeline");
    expect(flatEventCallId({ event: "call_started", room_name: "r1" })).toBe("r1");
    expect(flatEventCallId({ event: "call_started", data: { room_name: "r2" } })).toBe("r2");
    expect(flatEventCallId({ event: "call_started", data: { call_id: "r3" } })).toBe("r3");
    expect(flatEventCallId({ event: "call_started" })).toBeUndefined();
  });
});

describe("live Vaani payload layout (seen in production logs)", () => {
  it("reads the caller and id from nested data on lifecycle events", async () => {
    const { eventCallerNumber, flatEventCallId } = await import("../src/lib/pipeline");
    const started = { event: "call_started", timestamp: "2026-10-10T13:23:26Z", to: "+918000000000", from: "+919800000021", data: { room_name: "inbound-1", caller: "+919800000021", call_type: "Inbound", agent_name: "x" } };
    expect(flatEventCallId(started)).toBe("inbound-1");
    expect(eventCallerNumber(started)).toBe("+919800000021");
    expect(eventCallerNumber({ event: "call_started", from: "web-user", data: { room_name: "webrtc-1" } })).toBeUndefined();
  });

  it("takes start time and answer speed from call_postprocessing timestamps", async () => {
    const { normalizePayload } = await import("../src/lib/pipeline");
    const n = normalizePayload({
      event: "call_postprocessing", call_id: "inbound-2", timestamp: "2026-10-10T13:30:00Z", from: "+919800000022",
      data: { call_id: "inbound-2", room_name: "inbound-2", phone_number: "+919800000022", call_duration: 90000,
        call_started_at: "2026-10-10T13:20:00.000000", call_ringing_at: "2026-10-10T13:20:01.000000", picked_up_at: "2026-10-10T13:20:04.500000",
        transcript: "AGENT: hi\n\nUSER: hello", entities: {} },
    });
    expect(n.callerNumber).toBe("+919800000022");
    expect(n.startedAt.toISOString()).toBe("2026-10-10T13:20:00.000Z");
    expect(n.answeredAfterSec).toBe(4);
  });
});
