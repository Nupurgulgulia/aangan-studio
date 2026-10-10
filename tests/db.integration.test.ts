import { afterAll, describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { findByVaaniId, getCall, listInReview, updateCall, upsertByVaaniId } from "../src/lib/db";
import { processCall } from "../src/lib/pipeline";

// Runs only when DATABASE_URL is set:  node --env-file=.env.local node_modules/vitest/vitest.mjs run
const run = process.env.DATABASE_URL ? describe : describe.skip;
const ID = `itest-${Date.now()}`;

run("Neon round trip", () => {
  afterAll(async () => {
    await neon(process.env.DATABASE_URL!).query("DELETE FROM calls WHERE vaani_call_id LIKE $1", [`${ID}%`]);
  });

  it("upsert merges columns and keeps untouched ones (booking tool then webhook)", async () => {
    const id = await upsertByVaaniId({ vaani_call_id: `${ID}-a`, booking_start: "2026-10-12T11:00:00+05:30" });
    const id2 = await upsertByVaaniId({
      vaani_call_id: `${ID}-a`,
      caller_number: "+919800000099",
      criteria: { real_project: { status: "pass" } },
      deal_value_inr: 1200000,
    });
    expect(id2).toBe(id);
    const row = await getCall(id);
    expect(row?.booking_start).toBeTruthy(); // preserved
    expect(row?.caller_number).toBe("+919800000099");
    expect((row?.criteria as any).real_project.status).toBe("pass"); // jsonb round-trips as an object
    expect(row?.deal_value_inr).toBe(1200000); // numeric -> number
    expect(typeof row?.created_at).toBe("string");
  });

  it("updateCall rejects unknown columns", async () => {
    const id = await upsertByVaaniId({ vaani_call_id: `${ID}-b` });
    await expect(updateCall(id, { "status = 'x'; --": 1 })).rejects.toThrow(/unknown column/);
  });

  it("a dropped call is parked for the front desk, not lost, and reprocessing is idempotent", async () => {
    const payload = {
      vaaniCallId: `${ID}-c`,
      callerNumber: "+919800000003",
      startedAt: new Date("2026-10-08T22:05:00+05:30"),
      durationSec: 9,
      answeredAfterSec: 3,
      answerTrigger: "after_hours",
      transcript: "Agent: Namaste.\nCaller: Hello?",
    };
    const first = await processCall(payload);
    expect(first.label).toBe("borderline");
    const row = await getCall(first.id);
    expect(row?.status).toBe("in_review");
    expect(row?.after_hours).toBe(true);
    expect((await listInReview()).some((r) => r.id === first.id)).toBe(true);

    const again = await processCall(payload);
    expect(again.duplicate).toBe(true);
    expect(again.id).toBe(first.id);
    expect((await findByVaaniId(payload.vaaniCallId))?.label).toBe("borderline");
  });
});
