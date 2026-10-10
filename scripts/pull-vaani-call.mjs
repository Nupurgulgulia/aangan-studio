// Fetches a finished call from Vaani's API and feeds it to the app as a
// call_postprocessing event. Use it when the webhook can't reach the app
// (local demo, before deploying) or to recover a missed webhook.
//   node --env-file=.env.local scripts/pull-vaani-call.mjs <call_id>
const callId = process.argv[2];
if (!callId) throw new Error("usage: pull-vaani-call.mjs <call_id>");
const key = process.env.VAANI_API_KEY?.trim();
const secret = process.env.VAANI_WEBHOOK_SECRET?.trim();
if (!key || !secret) throw new Error("VAANI_API_KEY and VAANI_WEBHOOK_SECRET must be set");
const api = "https://api.vaanivoice.ai/api";
const h = { "X-API-Key": key };

const t = await fetch(`${api}/transcript/${encodeURIComponent(callId)}`, { headers: h });
if (t.status === 404) throw new Error("Transcript not ready yet (Vaani returns 404 until post-processing finishes). Try again in a minute.");
if (!t.ok) throw new Error(`Vaani transcript ${t.status}: ${(await t.text()).slice(0, 200)}`);
const { transcript } = await t.json();

// Extracted entities (caller_name, consultation_booked, consultation_time) live in call details.
const d = await fetch(`${api}/call_details/${encodeURIComponent(callId)}`, { headers: h });
const details = d.ok ? await d.json() : {};
const entities = details.entity && typeof details.entity === "object" ? details.entity : {};

const event = {
  event: "call_postprocessing",
  call_id: callId,
  timestamp: new Date().toISOString(),
  data: { call_id: callId, room_name: callId, call_duration: 0, transcript, summary: details.summary, entities },
};
const base = process.env.APP_URL?.trim() || "http://localhost:3000";
const res = await fetch(`${base}/api/vaani/webhook?secret=${encodeURIComponent(secret)}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(event),
});
console.log(res.status, await res.text());
