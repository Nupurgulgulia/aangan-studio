# Aangan Studio: phone enquiry voice agent

An AI voice agent that answers Aangan Studio's incoming calls at any hour, decides whether each caller is worth a designer's time using the founder's written rules, books the next designer in rotation from 14 calendars, and sends that designer a handoff message with an urgency tier.

Built for the MESA "AI and its Application" Case 03 (Nikhil: Unanswered Enquiries).

## What is here
- `docs/agent-prompt.md`: the instructions the Vaani voice agent runs on
- `docs/tools.json`: the three tools the agent calls (`check_area`, `book_consultation`, `log_call`)
- `docs/test-calls.md`: answer key for the 20 phone transcripts, plus extra stress calls
- `docs/SETUP.md`: current status and the steps still needing a person
- `docs/class-materials/`: briefing PDF and the components map
- `handlers/`, `lib/`, `src/`: the backend, deployed as a Neon Function (`neon.ts`)
- `db/`: schema and the 14 designers
- `public/`: front-desk queue and designer calendar screens
- `test/`: automated tests (`npm test`)

## Run it locally
```
npm install
npm start          # http://localhost:3000, uses a local test database
npm run simulate   # replays the 20 phone calls through the tools
npm test
```
Copy the variable names from `.env.example` into a `.env` file. Real keys never go in the repository.

## Design rules worth knowing
- The agent never quotes a price, range or per-sq-ft figure.
- It never asks about budget.
- When unsure, it forwards the lead. A decline needs a stated fact and a read-back, and every decline is reviewed.
- Standard call-back time is 48 hours; Priority is 24 hours; Hot is 2 working hours.

## Logins

`npm run users create` makes a login for every designer and writes one-time passwords to `credentials.local.txt` (never committed). `npm run dev` runs everything locally on a throwaway database.
