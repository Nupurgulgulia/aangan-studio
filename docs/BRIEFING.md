# Evaluator briefing: Case 03, Nikhil: Unanswered Enquiries

**The problem.** Aangan Studio gets about 200 enquiries a month. 48% get no answer within 48 hours, and a third arrive outside the 10am to 7pm desk hours. An answer within an hour converts at four times the rate of a next-day answer. When a lead does reach a designer, it arrives with no context. Scope: incoming phone calls only.

**What we built.** Chayya, a voice agent on Vaani, answers every call in English, and switches to Hindi or Marathi when the caller speaks it. She asks Nikhil's questions one at a time, checks the service area, and decides fit using `qualified.md`. She then tiers the lead and books a 30-minute consultation with the next designer in a round robin over 14 calendars. The designer gets an email brief, so the first conversation starts with everything already asked. Nikhil sees the pipeline in HubSpot.

## Try it (about 5 minutes)
1. Open https://aangan-studio-psi.vercel.app and log in as `aryan` with the password `1234567890`.
2. **My leads:** tier, call-by countdown, and the status path from new to won. Open a lead to see the details, the transcript and the activity timeline, including Chayya's messages.
3. **Needs attention:** escalations (15-minute callback), missed calls, and declines. Reverse a decline: the caller is booked as a Hot lead with the next designer.
4. **Calendar:** Aryan's week, with other designers shown as busy. Add a site visit; overlaps and out-of-hours times are refused.
5. **My projects:** stage, progress, designs, site photos and customer messages. Upload a photo.
6. Log out, then log in as `nikhil` for the founder view: calls answered, leads, won value, pipeline by stage, tier, source and designer, and what the agent costs per qualified lead.
7. Log out, then log in as `chayya`. The voice-agent console shows calls handled in the last 24 hours, the next designer in rotation, and for each call whether she assigned a designer, booked a slot, emailed the designer, saved the WhatsApp draft and created the HubSpot deal.

## Decisions Nikhil will ask about
- **Email, not Telegram, for the handoff.** Designers already work from their inbox. The brief has nine fields and reads better laid out. Email leaves a searchable record and needs no app install or per-designer chat ID. The email links straight to the call in the dashboard, where the status buttons live. Telegram is kept as an optional second channel.
- **The Cut: no price quotes.** Nikhil asked the agent to quote per-sq-ft pricing. His own `pricing.md` says no number may ever be quoted, because pricing varies by site. Chayya deflects and offers the consultation.
- **A wrong decline costs most.** So she only declines on a stated fact plus a read-back, and every decline lands in Needs attention for a person to check.
- **Hot leads** (short timeline, decision-maker present, referral or a large job) must be called within 2 working hours. If no slot fits in time, the earliest slot is booked and flagged `window_missed`.

## How data gets in
Calls arrive through the agent's three tools (`check_area`, `book_consultation`, `log_call`). Projects arrive through designer uploads and forms. Demo data comes from `node scripts/seed-demo.js` and is flagged `is_demo`. Details are in [how-the-data-gets-here.md](how-the-data-gets-here.md).

## Known gaps
- **No real phone number yet.** Buying one is a paid decision, so test calls use Vaani's web audio call.
- **WhatsApp is not connected.** Caller confirmations are saved as drafts marked "not sent".
- **Vaani transcripts are not synced automatically.** Live-call transcripts stay in Vaani History until a sync is wired to `/api/call-update`.
- **Vaani cannot embed its call widget in a website yet.** Its "Deploy on a Website" option shows Coming soon, so the console opens the agent in Vaani.
- **One shared inbox.** All 14 designer emails go to one address, because Resend's test sender only delivers to the account owner. A verified sending domain fixes this.
- **Weak demo password.** It is shared by every login. `node scripts/users.js reset <name>` issues a real one.
- **HubSpot free plan.** It cannot chart our own fields, so the tier, source and designer breakdowns live in the app's founder view; HubSpot keeps every deal and the free stage reports.
- **Demo deals in HubSpot.** The 75 demo deals are tagged with an Aangan call ID and can be removed in one pass.
- **Hygiene.** Rotate the database password, the Resend key and the HubSpot token, and revoke unused API keys.
