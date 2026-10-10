# Current status (10 Oct 2026, later)

- **Chayya** is the studio's front desk: the voice agent on the phone, and the sender of every message after a call (Telegram to the
  designer, WhatsApp confirmation to the caller). See `docs/how-the-data-gets-here.md` for where every piece of data comes from.
- Dashboard (https://aangan-gold.vercel.app) now has **My projects**: customer, site address, stage and progress, designs, site
  photos, visits and Chayya's messages. Designers create a project from a won lead, upload photos and designs (phone camera works),
  move the stage, and schedule visits that cannot overlap anything already on their calendar.
- Demo data: 44 ongoing projects, 30 open leads, calendars, transcripts, designs and photos for all 14 designers, Aryan the richest.
  Flagged `is_demo`. `npm run seed:demo` recreates it, `node scripts/seed-demo.js --remove` deletes only it.
- Photos are free Pexels stock photos (credits in `public/photos/CREDITS.md`). Drawings are generated SVG.

# Current status (10 Oct 2026)

- Dashboard: https://aangan-gold.vercel.app. One app, one login per designer (14). The voice agent answers the phone, so there is no front desk role.
  - My leads: your own leads, soonest deadline first, tap to call, one tap to the next status. Call page shows details, transcript, recording, activity.
  - Needs attention: shared by every designer. Escalations (call back within 15 minutes), missed calls, and declined calls to check, with a
    "reverse" button that books a wrongly declined caller as a hot lead. Escalations also send a Telegram alert.
  - Calendar: your own week, or all 14 calendars by day (other designers show as busy).
  - Founder reporting is not here. It lives in the CRM, which is a separate system.
- Logins: `npm run users create` makes any missing login and writes one-time passwords to `credentials.local.txt`
  (not committed). Forgotten password: `npm run users reset <username>`. Five wrong passwords lock an account for 10 minutes.
- Keys: the voice agent still uses `x-api-key` (`AGENT_API_KEY`) on `check_area`, `book_consultation`, `log_call` and `call-update`.
  The key no longer opens any dashboard data.
- Transcript and recording: the dashboard shows them when attached. A voice-platform webhook or sync job attaches them with
  `POST /api/call-update` (header `x-api-key`; body `call_id`, `transcript`, `recording_url`, `duration_sec`). Until that is wired,
  the call page links to Vaani, Conversations, History.
- Vercel only hosts `public/` and forwards `/api/*` to the Neon Function (`vercel.json`), so it holds no database or agent key.
- The CRM push after a booking is still in the backend and is skipped without `HUBSPOT_TOKEN`.
- Local try-out without any accounts: `npm run dev` (throwaway database, logins in `.data/credentials.txt`), then `npm run simulate`.

# Current status (8 Oct 2026)

- Vaani agent runs on `docs/agent-prompt.md` (lean, about 5.8k characters) plus a Vaani knowledge base built from
  `docs/knowledge-base/aangan-knowledge.md` (services, area, timelines, pricing rules, worked examples, Hindi and Marathi lines).
  The longer version is kept in `docs/agent-prompt-full.md` for reference.
- Agent settings: OpenAI gpt-4o-mini, Hindi with English fallback, Sarvam speech recognition, Cartesia voice, knowledge base on.
- The chat test panel in Vaani does not appear to run tools or knowledge-base lookups. Test those with the Audio test or a
  real call, then read the function logs with `neon logs query --since 5m`.

# Earlier status (7 Oct 2026)

- Neon project "Ai voice tool", production branch: tables created, 14 designers loaded.
- Backend is deployed as a Neon Function: https://br-icy-scene-b4fkyldc-aangan.compute.c-6.us-east-2.aws.neon.tech/
  (screens at /calendar and /queue; both ask for the key in `.env`).
- Vaani agent `aangan-studio-enquiry-agent` is created, with the greeting, the full instructions and three tools
  (`check_area`, `book_consultation`, `log_call`) switched on and saved.
- **One manual step left:** each of the three tools has `PASTE_YOUR_AGENT_API_KEY_HERE` in its `x-api-key` header.
  Replace it with the value of `AGENT_API_KEY` from `.env` (Vaani, Tools & Actions, open the tool, Headers, save).
  Until then every tool call is rejected and the agent says it hit an error.
- Not done: a phone number for inbound calls (Vaani, Telephony), the Telegram bot, the HubSpot token.

To redeploy after changing code: `set -a; source .env; set +a; neon deploy --env .env`

# Setup: what you need to do, in order

## Already done (by me)
- Backend code, 31 passing tests, the agent prompt, tool definitions and the test-call answer key.
- A private `AGENT_API_KEY` generated and saved in `.env` (Vaani sends it as the `x-api-key` header).
- A local server with a built-in test database and the dashboard.
- A replay of your 20 phone transcripts through the tools (`npm run simulate`).

## Try it now, no accounts needed
```
npm start            # http://localhost:3000, uses a local test database
npm run simulate     # in a second terminal: replays the 20 calls
npm run reset        # wipes the test database
```
Open `http://localhost:3000/calendar` and `http://localhost:3000/queue` (they ask for the key in `.env` once).

## Still needs you
Vaani can only call a public web address, so the three tools need to be reachable from the internet.



## 1. Neon database (about 3 minutes)
1. Sign up at neon.tech and create a project called `aangan-demo`.
2. Copy the connection string (starts with `postgresql://`). Treat it like a password.
3. Open `.env` in this folder and paste the string after `DATABASE_URL=`. Do not share the file.
4. Run `set -a; source .env; set +a; npm run migrate`. It creates the tables and the 14 designers.

## 2. A private key for the agent's tools
Already generated and saved in `.env` as `AGENT_API_KEY`. Copy the same value into Vercel's environment settings and into Vaani's tool headers (`x-api-key`).

## 3. Deploy so Vaani can reach it
The Vercel connection I have could read your projects but refused to create one (it asked for re-authentication, which only you can do). Either re-authorise it, or import this folder at vercel.com/new yourself, add the same two variables (and later the Telegram and HubSpot ones) in the project's environment settings. Check `BASE_URL/api/health` returns `{"ok":true,"designers":14}`.

## 4. Telegram (unlocks designer messages)
1. In Telegram, message @BotFather, send `/newbot`, and copy the bot token.
2. Each designer opens the bot and presses Start. Send each designer's chat id to be stored in `designers.telegram_chat_id`. For the demo, one chat id for everyone is enough.
3. Set `TELEGRAM_BOT_TOKEN` and a made-up `TELEGRAM_WEBHOOK_SECRET`, then point the bot's webhook at `BASE_URL/api/telegram` with that secret.

## 5. HubSpot free account (unlocks the founder's view)
1. Create a Private App (Settings, Integrations, Private Apps) with scopes for contacts and deals read/write and deal property write. Copy the token into `HUBSPOT_TOKEN`.
2. Run the property setup once (script to follow). The free plan allows 10 custom properties; we use 8.
3. The free plan has one deal pipeline. We use the default one and map the stages: call booked, held, proposal sent, won, lost.

## 6. Vaani
Create the agent, paste in `docs/agent-prompt.md`, add the three tools from `docs/tools.json`, and set the opening line. Then run the test calls in `docs/test-calls.md`.

Without steps 4 and 5 the system still works: bookings are made and saved, and the designer message and CRM record are skipped and reported as skipped.
