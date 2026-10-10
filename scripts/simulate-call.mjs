// Posts the fixtures to a running app as if Vaani had sent them.
//   node --env-file=.env.local scripts/simulate-call.mjs
//  - fixtures/sample-calls.json: flat finished-call payloads
//  - fixtures/vaani-events.json: one call as Vaani's real event sequence
import { readFileSync } from "node:fs";

const base = process.env.APP_URL || "http://localhost:3000";
const secret = process.env.VAANI_WEBHOOK_SECRET;
if (!secret) throw new Error("set VAANI_WEBHOOK_SECRET");
const load = (f) => JSON.parse(readFileSync(new URL(`../fixtures/${f}`, import.meta.url), "utf8"));

for (const body of [...load("sample-calls.json"), ...load("vaani-events.json")]) {
  // Same way Vaani will call it: secret in the URL, no custom header.
  const res = await fetch(`${base}/api/vaani/webhook?secret=${encodeURIComponent(secret)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log(body.event ?? "finished-call", body.call_id ?? body.room_name, res.status, await res.text());
}
