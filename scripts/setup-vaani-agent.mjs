// Creates the Aangan Studio voice agent in Vaani (docs.vaanivoice.ai/api-reference/create-agent).
//   node --env-file=.env.local scripts/setup-vaani-agent.mjs          # dry run: prints what it would send
//   node --env-file=.env.local scripts/setup-vaani-agent.mjs --apply  # creates the agent
//
// It sets the system prompt and the post-call data extraction this app reads
// (caller_name, consultation_booked, consultation_time). It deliberately does NOT
// send pricing.md. Phone number, voice/language, webhook URL and the Cal.com
// integration are set in the Vaani dashboard (see README).
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const promptFile = read("agent/voice-agent-prompt.md");
const body = promptFile.slice(promptFile.indexOf("\n---\n") + 5).replace(/<!--[\s\S]*?-->/g, "").trim();
const systemPrompt = [
  body,
  "# SERVICES (what the studio does and does not do)\n\n" + read("context/services.md").trim(),
  "# QUALIFICATION RUBRIC (collect evidence for these; never judge out loud)\n\n" +
    "Precedence: this rubric was written for studio staff. On calls you never decline or turn a caller away yourself, " +
    "even where it says \"decline\": follow \"Using the rubric\" above and say the team will get back within the working day. " +
    "A person on the front desk makes every final decision.\n\n" +
    read("context/qualified.md").trim(),
].join("\n\n");

// Guard: none of pricing.md's figures may reach the agent.
const priceFigures = [...new Set(read("context/pricing.md").match(/₹[\d.,]+/g) ?? [])];
const leaked = priceFigures.filter((f) => new RegExp(`${f.replace(/[.]/g, "\\.")}(?![\\d.,])`).test(systemPrompt));
if (leaked.length) throw new Error(`Refusing: system prompt contains pricing.md figures: ${leaked.join(", ")}`);

const payload = {
  agent_display_name: "Aangan Studio Phone Desk",
  config: {
    persona: {
      identity: {
        system_prompt: systemPrompt,
        greeting_message: {
          agent_message:
            "Namaste, aapne Aangan Studio ko call kiya hai. Main studio ka AI assistant hoon. Hum aapke project ki details note karke designer ke saath free consultation book kar sakte hain. Kya main kuch sawaal pooch loon?",
          interruptible: true,
        },
      },
      // Hindi first, auto-detect so English/Marathi callers still work. Vaani resets
      // ears/mouth to defaults if a later PATCH omits them, so always send both together.
      senses_capabilities: {
        language: "hi",
        auto_detect: true,
        ears: { stt: { primary: { provider: "deepgram", model: "nova-3", language: "hi", keywords: [], config: {} } } },
        mouth: {
          tts: {
            primary: {
              provider: "cartesia", model: "sonic-3-2025-10-27", voice_id: "1259b7e3-cb8a-43df-9446-30971a46b8b0",
              voice_name: "devansh", is_cloned: false,
              config: { speed: 1, language: "hi", emotion: ["positivity:highest", "curiosity:highest"], emotions: [] },
            },
            fallback: { provider: "elevenlabs", model: "eleven_flash_v2_5", voice_id: "9T9vSqRrPPxIs5wpyZfK", is_cloned: false, config: { language: "hi" } },
          },
        },
      },
    },
    analysis: {
      extraction: {
        data_collection: {
          enabled: true,
          data_points: [
            { name: "caller_name", prompt: "The caller's name as they said it. Null if not given.", nullable: true },
            {
              name: "consultation_booked",
              prompt: "Was a consultation successfully booked during this call? Answer yes only if the booking was confirmed.",
              values: ["yes", "no"],
              nullable: false,
            },
            {
              name: "consultation_time",
              prompt:
                "If a consultation was booked, its start time in ISO 8601 with the +05:30 offset, e.g. 2026-10-13T11:00:00+05:30. Null otherwise.",
              nullable: true,
            },
          ],
        },
      },
    },
  },
};

const apply = process.argv.includes("--apply");
console.log(`System prompt: ${systemPrompt.length} chars. Extraction fields: caller_name, consultation_booked, consultation_time.`);
if (!apply) {
  console.log("Dry run. Re-run with --apply to create the agent.\n");
  console.log(systemPrompt.slice(0, 600) + "\n...");
  process.exit(0);
}

const key = process.env.VAANI_API_KEY?.trim();
if (!key) throw new Error("VAANI_API_KEY is not set");
const res = await fetch("https://api.vaanivoice.ai/api/create-agent", {
  method: "POST",
  headers: { "X-API-Key": key, "content-type": "application/json" },
  body: JSON.stringify(payload),
});
const json = await res.json().catch(() => ({}));
if (!res.ok) throw new Error(`Vaani ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
console.log("Created agent:", json.agent_id, json.agent_name ?? "");
console.log("Add VAANI_AGENT_ID=" + json.agent_id + " to .env.local");
