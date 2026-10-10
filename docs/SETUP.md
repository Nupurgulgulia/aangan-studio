# Setup and status

## Status (10 Oct 2026)

| Part | State |
|---|---|
| Database | Neon project `aangan-studio` (`cool-smoke-94441287`), branch `main`. 12 tables, 14 designers, demo data loaded. The old Next.js `calls` table was renamed to `calls_legacy_nextjs`, and the branch `backup-before-chayya-2026-10-10` holds the database as it was before. |
| Backend | Neon Function `aangan`: `https://br-rough-scene-az415bu9-aangan.compute.c-3.ap-southeast-1.aws.neon.tech` |
| Dashboard | Vercel project `aangan-studio`: https://aangan-studio-psi.vercel.app. Serves `public/` and forwards `/api/*` to the Neon Function. Deploys automatically from GitHub `main`. |
| Logins | 14 designers (username is the first name in lowercase, e.g. `aryan`), `chayya` (the voice-agent test console) and `nikhil` (founder view, read only). Class demo password `1234567890` for all of them (weak, see Known gaps). Listed in `credentials.local.txt`, which is not committed. |
| Designer handoff | Email through Resend, with a link to the call in the dashboard. Every designer address points to `nupur@rggindia.in` for the demo, because Resend's test sender only delivers to the account owner. |
| Escalations | Email to `ESCALATION_EMAIL`, with a 15-minute callback promised to the caller. |
| HubSpot | Service key `aangan_studios` (scopes: contacts and deals read/write, deal schemas read/write). 8 custom `aangan_*` deal properties, 75 deals (demo plus the first live test booking). Every booked call creates a deal; status changes move it. Source is grouped into categories for reporting. |
| Founder view | `nikhil` login: pipeline by stage, tier, source, designer, won value by month, and what the voice agent costs. HubSpot free cannot chart custom fields, so these are drawn in the app; the HubSpot dashboard "Aangan Studio: Founder view (Nikhil)" holds the free ready-made deal reports. |
| Vaani agent | `aangan-studio-enquiry-agent` (id `0e7c8964-44e8-491b-bcb2-4df3fbb20306`). Tools `np_check_area`, `np_book_consultation`, `np_log_call` (tool names are global across Vaani, hence the prefix). First live voice test booked end to end on 10 Oct 2026. |

## Run locally
```
npm install
npm run dev:demo        # in-memory database (PGlite) with demo data, http://localhost:3000
npm test                # 58 tests: tiers, slots, area, store, auth and roles, API, demo data, email
```

## Deploy
```
npm test
node scripts/build-pages.js                   # embeds public/ into src/pages.ts for the Neon Function
neon deploy --project-id cool-smoke-94441287 --branch main --env .env --no-env-pull --update-existing
git push origin main                          # Vercel redeploys public/
```
After every deploy, check the live site: `https://aangan-studio-psi.vercel.app/api/health` should return `{"ok":true,"designers":14}`, then log in as `aryan` and open My leads.

## Data scripts (each needs `DATABASE_URL`)
| Command | What it does |
|---|---|
| `npm run migrate` | Creates or updates the tables and the 14 designers. Safe to re-run. |
| `node scripts/seed-demo.js` | Recreates the demo data, dated from today. Every row is flagged `is_demo`. |
| `node scripts/seed-demo.js --remove` | Deletes only the demo rows. |
| `node scripts/users.js create` | Creates any missing login, with a one-time password written to `credentials.local.txt`. |
| `node scripts/users.js reset <name>` | Gives that person a new one-time password and unlocks the account. |
| `node scripts/users.js demo-password` | Class demo only: sets every login to `1234567890`. |
| `node scripts/hubspot-properties.js` | Creates the 8 custom deal properties (needs `HUBSPOT_TOKEN`). |
| `node scripts/hubspot-backfill.js` | Sends booked calls that have no deal yet, demo calls included, using batch requests. |

## Reset to a clean demo
```
node scripts/seed-demo.js --remove
node scripts/seed-demo.js
node scripts/users.js demo-password
```

## HubSpot (founder's view)
Done. To repeat on a new account: create a service key (Development, Keys, Service Keys) with `crm.objects.contacts`, `crm.objects.deals` and `crm.schemas.deals`, each read and write. Put it in `.env` as `HUBSPOT_TOKEN`, then run `node scripts/hubspot-properties.js`, `node scripts/hubspot-backfill.js` and `node scripts/hubspot-resync.js`. New scopes can take about a minute to apply.
Charts grouped by our own fields (tier, source, designer) need a paid HubSpot plan, so they live in the app's founder view instead.

## Vaani agent
Configure it in app.vaanivoice.ai (agent `aangan-studio-enquiry-agent`, persona Chayya):
- **Language:** Hindi with English fallback. **STT:** Sarvam saaras:v3, with AssemblyAI as fallback. **LLM:** gpt-4o, with Groq llama-3.3-70b as fallback. **TTS:** Cartesia sonic-3.5 voice Arushi, with Sarvam bulbul:v3 voice ritu as fallback.
- **Greeting:** "Namaste, you've reached Aangan Studio. This is Chayya. How can I help you today?"
- **Prompt:** `docs/agent-prompt.md`. **Knowledge base:** `docs/knowledge-base/aangan-knowledge.md`.
- **Tools:** `np_check_area`, `np_book_consultation` and `np_log_call` from `docs/tools.json`. Replace `BASE_URL` with `https://aangan-studio-psi.vercel.app`, and set the `x-api-key` header to `AGENT_API_KEY` from `.env`.
- Save with Ctrl+S, then re-open the Overview page and check that the prompt length and tools are as expected. Pasted text sometimes fails to replace the old text, and unsaved edits are lost when you navigate away.
- Test with a web (RTC) audio call, using headphones in a quiet room, then check Vaani History and the Chayya console.

## Hygiene
- Rotate the Neon database password (it has appeared in tool output during setup), the Resend key and the HubSpot service key (both were pasted into chat), and the agent key.
- Revoke any API keys that are no longer used.
