// Vaani agent setup (docs.vaanivoice.ai).
//   node --env-file=.env.local scripts/setup-vaani-agent.mjs            # dry run: prints what it would send
//   node --env-file=.env.local scripts/setup-vaani-agent.mjs --apply    # creates a new agent
//   node --env-file=.env.local scripts/setup-vaani-agent.mjs --sync     # updates VAANI_AGENT_ID in place
//
// Sends: system prompt (agent/voice-agent-prompt.md + services.md + qualified.md, never pricing.md),
// greeting (with recording notice), Hindi voice/STT, "remember previous callers", and the post-call
// extraction fields the app reads (same keys as src/lib/gemini.ts FIELD_KEYS).
// Phone number, webhook URL and the Cal.com integration are set in the Vaani dashboard.
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const promptFile = read("agent/voice-agent-prompt.md");
const body = promptFile.slice(promptFile.indexOf("\n---\n") + 5).replace(/<!--[\s\S]*?-->/g, "").trim();
const systemPrompt = [
  body,
  "# SERVICES (what the studio does and does not do)\n\n" + read("context/services.md").trim(),
  "# QUALIFICATION RUBRIC (collect evidence for these; never judge out loud)\n\n" +
    "Precedence: this rubric was written for studio staff. On calls, the only time you turn someone away is a site outside Pune / PCMC. " +
    "For anything else that does not fit, even where it says \"decline\", say a designer will review and connect with them. " +
    "Budget never decides anything on the call.\n\n" +
    read("context/qualified.md").trim(),
].join("\n\n");

// Guards: none of pricing.md's figures may reach the agent; no { } (Vaani treats them as variables).
const priceFigures = [...new Set(read("context/pricing.md").match(/₹[\d.,]+/g) ?? [])];
const leaked = priceFigures.filter((f) => new RegExp(`${f.replace(/[.]/g, "\\.")}(?![\\d.,])`).test(systemPrompt));
if (leaked.length) throw new Error(`Refusing: system prompt contains pricing.md figures: ${leaked.join(", ")}`);
if (/[{}]/.test(systemPrompt)) throw new Error("Refusing: prompt contains { or } (Vaani treats them as variables).");

const greeting = "Namaste, आँगन स्टूडियो. Main AI assistant hoon, yeh call record ho rahi hai. Bataiye?"; // Devanagari name so the Hindi voice says "Aangan", not "Ahmed"

// Same keys the app reads (src/lib/gemini.ts FIELD_KEYS) plus consultation_time.
const dataPoints = [
  ["caller_name", "The caller's name."],
  ["caller_mobile", "The caller's mobile number as they said it, digits only (e.g. 9876543210)."],
  ["caller_email", "The caller's email address if they gave one, lowercase."],
  ["caller_type", "existing_client if they mention an ongoing project, an assigned designer or a complaint about work in progress; new_enquiry for a new project; other otherwise.", ["new_enquiry", "existing_client", "other"]],
  ["project_intent", "design_and_execution, advice_only (ideas, a visit, a second opinion), decor_only (styling, colours), furniture_only, vastu_only, or unclear.", ["design_and_execution", "advice_only", "decor_only", "furniture_only", "vastu_only", "unclear"]],
  ["property_category", "Type of property.", ["residential", "office", "clinic", "studio", "restaurant", "hotel", "retail", "gym", "other", "unknown"]],
  ["location_text", "The locality exactly as the caller said it (e.g. Baner, Talegaon). Not just Pune if they named an area."],
  ["carpet_area_sqft", "Carpet area in square feet as a number, if given."],
  ["bhk", "Number of bedrooms (BHK) as a number, if given."],
  ["scope_type", "full_home, partial (a floor or some rooms), single_room, commercial_fitout, or unknown.", ["full_home", "partial", "single_room", "commercial_fitout", "unknown"]],
  ["rooms_count", "For partial or single-room projects, how many rooms, as a number."],
  ["completion_text", "When they need the project complete, in their own words."],
  ["completion_needed_by", "When they need it complete as a date YYYY-MM-DD, using the call date as today; for a month only, the last day of the next occurrence of that month. Empty if not given or flexible."],
  ["timeline_flexible", "yes if they said no rush / flexible / whenever, otherwise no.", ["yes", "no"]],
  ["budget_text", "Their budget answer in their own words (e.g. around 15 lakhs, not decided)."],
  ["budget_min_inr", "Lower end of the stated budget in rupees as a plain number (15 lakhs = 1500000). Empty if not given."],
  ["budget_max_inr", "Upper end of the stated budget in rupees as a plain number (a single figure goes here). Empty if not given."],
  ["decision_maker", "yes if the caller decides; authorised if deciding with someone who knows they called; no if just researching for someone else; unclear otherwise.", ["yes", "authorised", "unclear", "no"]],
  ["structural_changes", "yes if they asked to move or break walls, otherwise no.", ["yes", "no"]],
  ["consultation_booked", "yes only if a consultation booking succeeded during the call, otherwise no.", ["yes", "no"]],
  ["consultation_time", "If a consultation was booked, its start time in ISO 8601 with the +05:30 offset. Empty otherwise."],
  ["notes_from_call", "Anything specific: kitchen, wardrobes, style, possession date, rented or owned, complaint details. One or two sentences."],
].map(([name, prompt, values]) => ({ name, prompt, ...(values ? { values } : {}), nullable: true }));

const analysis = { extraction: { data_collection: { enabled: true, data_points: dataPoints } } };
const senses = {
  language: "hi",
  auto_detect: true,
  ears: { stt: { primary: { provider: "deepgram", model: "nova-3", language: "multi", keywords: [], config: {} } } }, // multi = Hindi-English code-switching; "hi" garbled Hinglish callers
  mouth: {
    tts: {
      primary: {
        provider: "cartesia", model: "sonic-3-2025-10-27", voice_id: "1259b7e3-cb8a-43df-9446-30971a46b8b0", voice_name: "devansh", is_cloned: false,
        config: { speed: 1, language: "hi", emotion: ["positivity:highest", "curiosity:highest"], emotions: [] },
      },
      fallback: { provider: "elevenlabs", model: "eleven_flash_v2_5", voice_id: "9T9vSqRrPPxIs5wpyZfK", is_cloned: false, config: { language: "hi" } },
    },
  },
};

const mode = process.argv.includes("--sync") ? "sync" : process.argv.includes("--apply") ? "apply" : "dry";
console.log(`System prompt: ${systemPrompt.length} chars. Extraction fields: ${dataPoints.length}.`);
if (mode === "dry") {
  console.log("Dry run. --apply creates a new agent; --sync updates VAANI_AGENT_ID.\n");
  console.log(systemPrompt.slice(0, 500) + "\n...");
  process.exit(0);
}

const key = process.env.VAANI_API_KEY?.trim();
if (!key) throw new Error("VAANI_API_KEY is not set");
const headers = { "X-API-Key": key, "content-type": "application/json" };
async function call(method, url, payload) {
  const res = await fetch(url, { method, headers, body: payload === undefined ? undefined : JSON.stringify(payload) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

if (mode === "apply") {
  const j = await call("POST", "https://api.vaanivoice.ai/api/create-agent", {
    agent_display_name: "Aangan Studio Phone Desk",
    config: { persona: { identity: { system_prompt: systemPrompt, greeting_message: { agent_message: greeting, interruptible: true } }, senses_capabilities: senses }, analysis },
  });
  console.log("Created agent:", j.agent_id, "\nAdd VAANI_AGENT_ID=" + j.agent_id + " to .env.local, then run --sync once.");
  process.exit(0);
}

// --sync: section PATCH bodies are NOT wrapped (a wrapped body returns 200 but is ignored).
const id = process.env.VAANI_AGENT_ID?.trim();
if (!id) throw new Error("VAANI_AGENT_ID is not set");
const base = `https://api.vaanivoice.ai/api/agent/${id}`;
const current = await call("PATCH", `${base}/persona`, {}); // empty PATCH returns the stored config
const memories = { ...((current.persona ?? current).memories ?? {}), use_previous_call_contexts: true };
await call("PATCH", `${base}/persona`, {
  identity: { system_prompt: systemPrompt, greeting_message: { agent_message: greeting, interruptible: true } },
  senses_capabilities: senses, // ears + mouth together: Vaani resets whichever is omitted
  memories,
});
await call("PATCH", `${base}/analysis`, analysis);

// Verify what Vaani stored.
const after = await call("PATCH", `${base}/persona`, {});
const p = after.persona ?? after, sc = p.senses_capabilities ?? {};
const an = after.analysis ?? (await call("PATCH", `${base}/analysis`, {})).analysis;
const stored = an?.extraction?.data_collection?.data_points?.map((d) => d.name) ?? [];
console.log("Synced agent", id);
console.log("  prompt:        ", p.identity?.system_prompt === systemPrompt ? "ok" : "MISMATCH", `(${systemPrompt.length} chars)`);
console.log("  greeting:      ", p.identity?.greeting_message?.agent_message === greeting ? "ok" : "MISMATCH");
console.log("  language:      ", sc.language, "/ stt", sc.ears?.stt?.primary?.language, "/ tts", sc.mouth?.tts?.primary?.config?.language);
console.log("  remember calls:", p.memories?.use_previous_call_contexts);
console.log("  extraction:    ", stored.length, "fields", dataPoints.every((d) => stored.includes(d.name)) ? "ok" : "MISSING " + dataPoints.filter((d) => !stored.includes(d.name)).map((d) => d.name).join(","));
