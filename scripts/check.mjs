// Automated health check: config, external services (read-only), and the running app.
//   node --env-file=.env.local scripts/check.mjs        (app must be running on APP_URL)
// Sends no emails and writes nothing to HubSpot, Cal.com or Vaani.
import { neon } from "@neondatabase/serverless";

const env = (k) => (process.env[k] ?? "").trim();
const results = [];
const record = (area, name, status, detail = "") => results.push({ area, name, status, detail });
async function check(area, name, fn) {
  try {
    const out = await fn();
    if (out === true || out === undefined) record(area, name, "PASS");
    else if (typeof out === "string") record(area, name, "PASS", out);
    else record(area, name, out.status, out.detail ?? "");
  } catch (e) {
    record(area, name, "FAIL", String(e?.message ?? e).slice(0, 160));
  }
}
const fail = (detail) => ({ status: "FAIL", detail });
const warn = (detail) => ({ status: "WARN", detail });

// ---------- 1. Configuration ----------
const required = [
  "APP_URL", "DASHBOARD_PASSWORD", "VAANI_WEBHOOK_SECRET", "CRON_SECRET", "DATABASE_URL", "GEMINI_API_KEY",
  "GEMINI_MODEL", "RESEND_API_KEY", "EMAIL_FROM", "FRONT_DESK_EMAIL", "DESIGNERS", "CAL_API_KEY",
  "CAL_EVENT_TYPE_ID", "HUBSPOT_TOKEN", "VAANI_API_KEY", "VAANI_AGENT_ID",
];
for (const k of required) {
  await check("config", k, () => (!env(k) || env(k) === "change-me" ? fail("missing or placeholder") : true));
}
await check("config", "DESIGNERS is valid JSON", () => {
  const d = JSON.parse(env("DESIGNERS"));
  return Array.isArray(d) && d.every((x) => x.name && x.email) ? `${d.length} designer(s)` : fail("expected [{name,email}]");
});
await check("config", "cost rates set", () => {
  const zero = ["VAANI_COST_PER_MIN_INR", "GEMINI_INPUT_INR_PER_M_TOKENS", "GEMINI_OUTPUT_INR_PER_M_TOKENS"]
    .filter((k) => !(Number(env(k)) > 0));
  return zero.length ? warn(`0/unset: ${zero.join(", ")} (cost screen shows ₹0)`) : true;
});
await check("config", "dashboard password strength", () =>
  env("DASHBOARD_PASSWORD").length < 12 || /^\d+$/.test(env("DASHBOARD_PASSWORD"))
    ? warn("weak password: fine on localhost, change before deploying")
    : true);
await check("config", "APP_URL is public (needed for Vaani webhook)", () =>
  /localhost|127\.0\.0\.1/.test(env("APP_URL")) ? warn(`${env("APP_URL")}: Vaani cannot reach it; deploy first`) : true);

// ---------- 2. External services (read-only) ----------
const sql = env("DATABASE_URL") ? neon(env("DATABASE_URL")) : null;
await check("services", "Neon: calls table reachable", async () => {
  const [r] = await sql.query("select count(*)::int n from calls");
  return `${r.n} rows`;
});
await check("services", "Gemini: key + model", async () => {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env("GEMINI_MODEL")}`, { headers: { "x-goog-api-key": env("GEMINI_API_KEY") } });
  return r.ok ? env("GEMINI_MODEL") : fail(`${r.status} ${(await r.text()).slice(0, 100)}`);
});
await check("services", "Resend: key", async () => {
  const r = await fetch("https://api.resend.com/domains", { headers: { authorization: `Bearer ${env("RESEND_API_KEY")}` } });
  if (!r.ok) return fail(String(r.status));
  const verified = ((await r.json()).data ?? []).filter((d) => d.status === "verified");
  return verified.length ? `verified: ${verified.map((d) => d.name).join(", ")}` : warn("no verified domain: test sender only delivers to the Resend account's own email");
});
await check("services", "Resend: sender matches domain state", async () =>
  /resend\.dev/.test(env("EMAIL_FROM")) ? warn("EMAIL_FROM uses onboarding@resend.dev (test sender)") : true);
await check("services", "Cal.com: key + event type", async () => {
  const r = await fetch(`https://api.cal.com/v2/event-types/${env("CAL_EVENT_TYPE_ID")}`, { headers: { authorization: `Bearer ${env("CAL_API_KEY")}`, "cal-api-version": "2024-06-14" } });
  if (!r.ok) return fail(`${r.status}`);
  const t = (await r.json()).data ?? {};
  const loc = (t.locations ?? []).map((l) => l.type).join(",");
  return /video|integration/i.test(loc) ? warn(`"${t.title}" location is ${loc}: consultations are phone/in-person`) : `"${t.title}"`;
});
await check("services", "Cal.com: slots available next 7 days", async () => {
  const now = new Date(), end = new Date(Date.now() + 7 * 864e5);
  const r = await fetch(`https://api.cal.com/v2/slots?eventTypeId=${env("CAL_EVENT_TYPE_ID")}&start=${now.toISOString()}&end=${end.toISOString()}&timeZone=Asia%2FKolkata`, { headers: { authorization: `Bearer ${env("CAL_API_KEY")}`, "cal-api-version": "2024-09-04" } });
  if (!r.ok) return fail(String(r.status));
  const days = Object.keys((await r.json()).data ?? {});
  return days.length ? `${days.length} day(s) with slots` : warn("no slots in the next 7 days");
});
await check("services", "HubSpot: deals read + pipeline stages", async () => {
  const h = { authorization: `Bearer ${env("HUBSPOT_TOKEN")}` };
  const r = await fetch("https://api.hubapi.com/crm/v3/pipelines/deals", { headers: h });
  if (!r.ok) return fail(String(r.status));
  const stages = (await r.json()).results.flatMap((p) => p.stages.map((s) => s.id));
  const need = [env("HUBSPOT_STAGE_NEW") || "appointmentscheduled", env("HUBSPOT_STAGE_WON") || "closedwon", env("HUBSPOT_STAGE_LOST") || "closedlost"];
  const missing = need.filter((s) => !stages.includes(s));
  return missing.length ? fail(`stage ids not in pipeline: ${missing.join(", ")}`) : "stage ids match";
});

const vh = { "X-API-Key": env("VAANI_API_KEY"), "content-type": "application/json" };
let agent = null;
await check("services", "Vaani: key + agent exists", async () => {
  const r = await fetch("https://api.vaanivoice.ai/api/agents", { headers: vh });
  if (!r.ok) return fail(String(r.status));
  const list = await r.json();
  const a = (Array.isArray(list) ? list : list.data).find((x) => x.id === env("VAANI_AGENT_ID"));
  if (!a) return fail("VAANI_AGENT_ID not found in account");
  agent = a;
  return `${a.display_name} (${a.status})`;
});
await check("services", "Vaani: agent published", async () => (agent?.published ? true : warn("agent is not published (publish it in the Vaani dashboard)")));
await check("services", "Vaani: agent config (prompt, Hindi, extraction, no prices)", async () => {
  // An empty PATCH returns the full stored config without changing it.
  const r = await fetch(`https://api.vaanivoice.ai/api/agent/${env("VAANI_AGENT_ID")}/persona`, { method: "PATCH", headers: vh, body: "{}" });
  if (!r.ok) return fail(String(r.status));
  const j = await r.json(), p = j.persona ?? j, sc = p.senses_capabilities ?? {};
  const prompt = String(p.identity?.system_prompt ?? "");
  const problems = [];
  if (!prompt.startsWith("## Who you are")) problems.push("system prompt missing");
  if (["₹1,800", "₹2,400", "₹3,500", "₹1,200", "₹2,800", "₹4,000"].some((f) => prompt.includes(f))) problems.push("PRICE FIGURES IN PROMPT");
  const isHi = (v) => /^(hi|hindi)$/i.test(String(v ?? ""));
  if (!isHi(sc.language) || !/^(hi|hindi|multi)$/i.test(String(sc.ears?.stt?.primary?.language)) || !isHi(sc.mouth?.tts?.primary?.config?.language)) problems.push(`language not fully Hindi (lang ${sc.language}, stt ${sc.ears?.stt?.primary?.language}, tts ${sc.mouth?.tts?.primary?.config?.language})`);
  const points = (j.analysis?.extraction?.data_collection?.data_points ?? []).map((d) => d.name);
  for (const n of ["caller_name", "caller_mobile", "caller_email", "caller_type", "location_text", "budget_max_inr", "consultation_booked", "consultation_time"]) if (!points.includes(n)) problems.push(`extraction ${n} missing`);
  return problems.length ? fail(problems.join("; ")) : "prompt ok, Hindi, extraction ok, no prices";
});
await check("services", "Vaani: Cal.com booking tools attached", async () => {
  const j = await (await fetch(`https://api.vaanivoice.ai/api/agent/${env("VAANI_AGENT_ID")}`, { headers: vh })).json();
  const on = (j.persona?.actions?.functions ?? []).filter((f) => f.agent_config?.is_enabled ?? f.is_enabled).map((f) => f.function_name ?? f.name);
  const missing = ["Check_availability_booking", "book_appointment"].filter((n) => !on.includes(n));
  return missing.length ? fail(`not enabled: ${missing.join(", ")} (Persona -> Actions -> Integration Tools)`) : on.join(", ");
});
await check("services", "Vaani: inbound phone number assigned", async () => {
  const r = await fetch(`https://api.vaanivoice.ai/api/agent/${env("VAANI_AGENT_ID")}/persona`, { method: "PATCH", headers: vh, body: "{}" });
  const j = await r.json();
  const inbound = j.deployment_config?.phone?.call_type?.Inbound;
  return inbound ? `inbound ${inbound}` : warn("no inbound number (Vaani Telephony is empty); use /test-call for demos");
});

// ---------- 3. Running app ----------
const base = env("APP_URL") || "http://localhost:3000";
const auth = { authorization: "Basic " + Buffer.from("check:" + env("DASHBOARD_PASSWORD")).toString("base64") };
const badAuth = { authorization: "Basic " + Buffer.from("check:wrong").toString("base64") };
const hook = (q = `?secret=${encodeURIComponent(env("VAANI_WEBHOOK_SECRET"))}`) => `${base}/api/vaani/webhook${q}`;
const get = (path, headers = {}) => fetch(base + path, { headers, redirect: "manual" });

await check("app", "server up", async () => { await get("/"); return base; });
for (const p of ["/dashboard", "/dashboard/ops", "/review", "/test-call"]) {
  await check("app", `${p}: 401 without / wrong password, 200 with`, async () => {
    const [a, b, c] = await Promise.all([get(p), get(p, badAuth), get(p, auth)]);
    return a.status === 401 && b.status === 401 && c.status === 200 ? true : fail(`no-auth ${a.status}, wrong ${b.status}, right ${c.status}`);
  });
}
const [anyLead] = sql ? await sql.query("select id from calls where label is not null order by created_at desc limit 1") : [];
if (anyLead) {
  await check("app", "/lead/<id> renders", async () => ((await get(`/lead/${anyLead.id}`, auth)).status === 200 ? true : fail("not 200")));
}
await check("app", "/lead/<unknown uuid> -> 404", async () => {
  const s = (await get("/lead/00000000-0000-0000-0000-000000000000", auth)).status;
  return s === 404 ? true : fail(`got ${s}`);
});
await check("app", "/lead/<not-a-uuid> -> 404 (not a server error)", async () => {
  const s = (await get("/lead/not-a-real-id", auth)).status;
  return s === 404 ? true : fail(`got ${s}`);
});
await check("app", "PATCH /api/leads/<not-a-uuid> -> 404", async () => {
  const r = await fetch(`${base}/api/leads/not-a-real-id`, { method: "PATCH", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ action: "accept" }) });
  return r.status === 404 ? true : fail(`got ${r.status}`);
});
await check("app", "PATCH /api/leads invalid body -> 400", async () => {
  if (!anyLead) return warn("no lead to test against");
  const r = await fetch(`${base}/api/leads/${anyLead.id}`, { method: "PATCH", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ action: "set_stage", stage: "lost" }) });
  return r.status === 400 ? true : fail(`got ${r.status}`);
});
await check("app", "webhook: wrong/missing secret -> 401", async () => {
  const [a, b] = await Promise.all([
    fetch(hook("?secret=nope"), { method: "POST", body: "{}" }),
    fetch(hook(""), { method: "POST", body: "{}" }),
  ]);
  return a.status === 401 && b.status === 401 ? true : fail(`${a.status}/${b.status}`);
});
await check("app", "webhook: unknown Vaani event -> 200 ignored", async () => {
  const r = await fetch(hook(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "call_ringing", room_name: "check-room" }) });
  const j = await r.json();
  return r.status === 200 && j.kind === "ignored" ? true : fail(`${r.status} ${JSON.stringify(j).slice(0, 80)}`);
});
await check("app", "webhook: payload with no call id -> 400 (not 500, so Vaani won't retry forever)", async () => {
  const r = await fetch(hook(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "call_postprocessing", data: {} }) });
  return r.status === 400 ? true : fail(`got ${r.status}`);
});
await check("app", "webhook: malformed JSON -> 400", async () => {
  const r = await fetch(hook(), { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" });
  return r.status === 400 ? true : fail(`got ${r.status}`);
});
await check("app", "webhook: duplicate call is idempotent", async () => {
  const [row] = await sql.query("select vaani_call_id from calls where label is not null and transcript is not null order by created_at asc limit 1");
  if (!row) return warn("no scored call to replay");
  const r = await fetch(hook(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ call_id: row.vaani_call_id, transcript: "Agent: hi\nCaller: hello\nCaller: again" }) });
  const j = await r.json();
  return j.duplicate === true ? true : fail(JSON.stringify(j).slice(0, 100));
});
await check("app", "cron: rejects missing secret", async () => {
  const s = (await get("/api/cron/reminders")).status;
  return s === 401 ? true : fail(`got ${s}`);
});
await check("app", "test-call API protected", async () => {
  const s = (await fetch(`${base}/api/test-call`, { method: "POST" })).status;
  return s === 401 ? true : fail(`got ${s}`);
});

// ---------- 4. Data integrity ----------
if (sql) {
  await check("data", "no junk empty-transcript leads", async () => {
    const rows = await sql.query("select vaani_call_id from calls where label is not null and coalesce(length(transcript),0) = 0");
    return rows.length ? warn(`${rows.length} scored call(s) with empty transcript: ${rows.map((r) => r.vaani_call_id).join(", ")}`) : true;
  });
  await check("data", "no unscored rows older than 1 hour (lost calls)", async () => {
    const rows = await sql.query("select vaani_call_id from calls where label is null and created_at < now() - interval '1 hour'");
    return rows.length ? fail(`${rows.length} call(s) never scored: ${rows.map((r) => r.vaani_call_id).join(", ")}`) : true;
  });
  await check("data", "qualified leads reached a designer", async () => {
    const rows = await sql.query("select vaani_call_id, email_error from calls where label='qualified' and (designer_name is null or email_error is not null)");
    return rows.length ? fail(rows.map((r) => `${r.vaani_call_id}: ${r.email_error ?? "no designer"}`).join("; ").slice(0, 160)) : true;
  });
  await check("data", "HubSpot sync errors", async () => {
    const rows = await sql.query("select vaani_call_id, hubspot_error from calls where hubspot_error is not null");
    return rows.length ? fail(rows.map((r) => `${r.vaani_call_id}: ${r.hubspot_error}`).join("; ").slice(0, 160)) : true;
  });
  await check("data", "test calls not pushed to HubSpot with a fake phone", async () => {
    const rows = await sql.query("select vaani_call_id from calls where caller_number !~ '^\\+?[0-9]{7,15}$' and hubspot_deal_id is not null");
    return rows.length ? warn(`${rows.length} deal(s) for calls without a real phone: ${rows.map((r) => r.vaani_call_id).join(", ")}`) : true;
  });
  await check("data", "scoring errors", async () => {
    const rows = await sql.query("select vaani_call_id from calls where scoring_error is not null");
    return rows.length ? warn(`${rows.length} call(s) failed scoring (parked in review)`) : true;
  });
  await check("data", "qualified leads awaiting designer > 2 working hrs (reminder due)", async () => {
    const rows = await sql.query("select vaani_call_id from calls where status='with_designer' and accepted_at is null and reminded_at is null and created_at < now() - interval '2 hours'");
    return rows.length ? warn(`${rows.length} lead(s) not yet accepted; reminder cron would email the front desk: ${rows.map((r) => r.vaani_call_id).join(", ")}`) : true;
  });
}

// ---------- report ----------
const icon = { PASS: "✅", WARN: "⚠️ ", FAIL: "❌" };
let area = "";
for (const r of results) {
  if (r.area !== area) { area = r.area; console.log(`\n== ${area}`); }
  console.log(`${icon[r.status]} ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
}
const n = (s) => results.filter((r) => r.status === s).length;
console.log(`\n${n("PASS")} passed, ${n("WARN")} warnings, ${n("FAIL")} failed`);
process.exitCode = n("FAIL") ? 1 : 0;
