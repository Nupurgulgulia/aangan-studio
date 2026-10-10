# Aangan Studio: phone enquiry voice agent (Chayya)

Chayya is an AI voice agent that answers Aangan Studio's incoming calls at any hour. She decides whether each caller is worth a designer's time using Nikhil's written rules, books the next designer in rotation from 14 calendars, and emails that designer a handoff brief with an urgency tier.

Built for the MESA "AI and its Application" Case 03 (Nikhil: Unanswered Enquiries). The base code comes from [patilprithvi2098/Aangan](https://github.com/patilprithvi2098/Aangan). This repository adds email handoffs through Resend, a deployment on this team's Neon, Vercel and HubSpot accounts, and the evaluator documents.

- **Live dashboard:** https://aangan-studio-psi.vercel.app
- **Evaluator briefing:** [docs/BRIEFING.md](docs/BRIEFING.md)
- **Setup, status, reset:** [docs/SETUP.md](docs/SETUP.md)
- **Where every piece of data comes from:** [docs/how-the-data-gets-here.md](docs/how-the-data-gets-here.md)
- **Components map (as built):** [docs/class-materials/Components_Map_Chayya.svg](docs/class-materials/Components_Map_Chayya.svg), drawn by `node scripts/make-map.mjs`. `Components_Map_Aangan.*` is the original repo's pre-build map, kept for reference.

## What is here
- `docs/agent-prompt.md`: the instructions the Vaani voice agent runs on. The knowledge base is `docs/knowledge-base/aangan-knowledge.md`.
- `docs/tools.json`: the three tools the agent calls (`check_area`, `book_consultation`, `log_call`).
- `docs/test-calls.md`: answer key for the phone transcripts, plus extra stress calls.
- `handlers/`, `lib/`, `src/`: the backend, deployed as a Neon Function (`neon.ts`).
- `db/`: schema and the 14 designers.
- `public/`: the designer dashboard and the Chayya test console. Vercel serves it and forwards `/api/*` to Neon.
- `test/`: automated tests (`npm test`).

## Run it locally
```
npm install
npm run dev:demo   # http://localhost:3000 on a throwaway in-memory database with demo data
npm test
```
Copy the variable names from `.env.example` into a `.env` file. Real keys never go in the repository.

## Design rules worth knowing
- The agent never quotes a price, a range or a per-sq-ft figure. This is "the Cut": Nikhil asked for it, and `pricing.md` forbids it.
- It never asks about budget.
- When unsure, it forwards the lead. A decline needs a stated fact and a read-back, and every decline is reviewed.
- Call-back windows: Hot is 2 working hours, Priority is 24 hours, Standard is 48 hours.
