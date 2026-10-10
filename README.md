# Aangan Studio: Phone Enquiry Handler

Every call answered, qualified leads reach a designer with the full brief, Nikhil sees it all.

```
Caller -> Vaani Labs (after hours / 3 rings) -> voice agent (agent/voice-agent-prompt.md)
       -> books the consultation in-call via Vaani's own Cal.com integration
       -> Vaani events -> POST /api/vaani/webhook?secret=...
            call_started (caller number) -> user_picked_up_at (answer time) -> call_postprocessing (transcript)
            -> log to Neon Postgres
            -> price-quote guard on what the AI said
            -> Gemini Flash judges 5 criteria with caller quotes as evidence
            -> rule engine (src/lib/rubric.ts) sets the label
                 qualified  -> email to designer (Resend) + HubSpot deal
                 borderline / not_a_fit -> front-desk review queue (/review); a person decides
       -> /dashboard (pipeline & revenue), /dashboard/ops (speed & cost)
```

## Production

- App: https://aangan-studio-psi.vercel.app (Vercel project `aangan-studio`, team Mesa, region bom1/Mumbai). Use this URL: the `*-mesa-8ce2.vercel.app` aliases sit behind Vercel's team login and would block Vaani.
- Env vars live in Vercel (same keys as `.env.example`); the production dashboard password differs from local.
- Deploys: pushes to `main` are blocked by Vercel when the commit author email isn't linked to the Vercel account; deploy via the Vercel dashboard/connector, or link the email.
- Reminder cron runs daily (Vercel Hobby limit); the 2-working-hour reminder also runs on every Vaani event.
- `APP_URL=https://aangan-studio-psi.vercel.app DASHBOARD_PASSWORD=... npm run check` runs the health check against production.

## Design decisions

- **Scope comes from services.md.** Criterion 1 fails for work the studio doesn't do (structural, decor-only, standalone furniture, Vastu-only, restaurants/hotels/retail/gyms, offices over ~3,000 sq ft), even in Pune with a good timeline.
- **The model never picks the label.** Gemini returns pass/fail/unclear per criterion plus a verbatim caller quote. `decide()` applies `qualified.md` in code: 2+ fails = not a fit, 1 fail or unclear on criteria 1-3 = borderline, unclear budget/decision-maker = qualified with a note. A "fail" whose quote isn't in the transcript is downgraded to "unclear", so nobody is rejected on an invented quote.
- **The AI never turns anyone away.** Borderline and not-a-fit both go to the front desk; closing a lead needs a person's name and a reason (it becomes the lost reason in the dashboard and HubSpot).
- **No pricing, by construction.** The voice agent is never given `pricing.md` (only the approved deflection line). A post-call guard flags any call where the AI stated a figure or "per sq ft" phrase; flagged calls show a warning on the lead page and in the designer email.
- **No lead is lost to a failure.** Scoring error, dropped call, or failed designer email all land in the review queue.
- **Handoff is email (Resend)**: a designer needs the full brief, rubric table and booking in one searchable message; Telegram is better for pings than for records. A 2-working-hour reminder goes to the front desk if a designer hasn't accepted (cron, every 30 min).

## Setup

1. `cp .env.example .env.local` and fill it in (cost rates default to 0; the dashboard warns until you set real ones).
2. Create a Neon project, put the pooled connection string in `DATABASE_URL`, then `npm run db:migrate` (applies `db/schema.sql`, safe to re-run).
3. `npm install && npm run dev`. Tests: `npm test` (unit); with `DATABASE_URL` loaded the Neon integration test also runs: `node --env-file=.env.local node_modules/vitest/vitest.mjs run`
4. Vaani (docs.vaanivoice.ai):
   - `node --env-file=.env.local scripts/setup-vaani-agent.mjs` (dry run), then `--apply` to create the agent with our prompt and post-call extraction (`caller_name`, `consultation_booked`, `consultation_time`). It never sends `pricing.md`.
   - Dashboard -> Settings -> Webhooks: `{APP_URL}/api/vaani/webhook?secret={VAANI_WEBHOOK_SECRET}` (Vaani sends no signature and takes no custom headers, so the secret rides in the URL).
   - Dashboard -> Settings -> Integrations -> Cal.com: paste the Cal.com key, pick the "30 min meeting" event type.
   - Assign the inbound number to the agent (dashboard, or `PATCH /api/agent/{id}/deployment`).
   - After-hours / 3-ring routing is not a Vaani setting: configure it at the studio's phone line (forward on no-answer after 3 rings, and unconditionally 7pm-10am) to the Vaani number.
5. `npm run simulate` posts the fixtures from `fixtures/` through the whole pipeline.
6. Deploy to Vercel (cron in `vercel.json`).

## Demo / testing without a phone number

- **/test-call** (password-protected): talk to the agent from the browser (Vaani WebRTC session, started server-side so the API key never reaches the browser). After hanging up, **Score this call** pulls the transcript from Vaani's API and runs the normal pipeline: scoring, designer email, HubSpot, dashboards. Works locally, before the webhook is public.
- `node --env-file=.env.local scripts/pull-vaani-call.mjs <call_id>` does the same from the command line, e.g. for a demo-number call or a missed webhook.
- Inbound demo number: provisioned in the Vaani dashboard, then assigned with `PATCH /api/agent/{id}/deployment` (`{"deployment":{"phone":{"call_type":{"Inbound":"+91..."}}}}`). Vaani rejects numbers not in the account.

## Not yet verified (needs your accounts)

- Vaani payload handling follows the docs (event names, `data.transcript` as `[HH:MM:SS] AGENT/USER:` lines, `call_duration` in ms) but has not seen a live call yet. Two documented-but-unconfirmed points: `room_name` on `call_started` equals `call_id` on `call_postprocessing`, and on inbound calls `phone_number` is the caller. Vaani's call-history API currently returns a 500 for this account, so per-call cost uses the per-minute estimate.
- `/api/tools/slots` and `/api/tools/book` are unused with Vaani (no custom tools); kept for a future channel.
- Cal.com v2 request shapes (`src/lib/calcom.ts`), HubSpot stage ids, Gemini model name.
- Working days assumed Mon-Sat (`src/lib/hours.ts`).
- Dashboard "pipeline" reads from Neon (the single source); HubSpot receives deals and outcomes but is not read back.

## Out of scope (extension path)

WhatsApp and the web form would only change trigger and input: they feed the same `processCall` scoring, handoff and dashboards.
