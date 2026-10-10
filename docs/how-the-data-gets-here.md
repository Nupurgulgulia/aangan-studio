# Where every piece of data comes from

For anyone asking "how did this get here?". Everything on the dashboard is either captured by the voice agent, entered or
uploaded by a designer, or written by the system. Nothing is typed in by hand behind the scenes, except the demo data described at the end.

| What you see | Who or what creates it | How |
|---|---|---|
| A call, with its transcript, summary, qualification and urgency | **Chayya**, the voice agent (Vaani) | Chayya asks the questions on the call, then calls our tools: `check_area`, then `book_consultation` or `log_call`. The transcript and recording are attached by the voice platform through `POST /api/call-update`. |
| Which designer gets the lead, and the 30 minute consultation slot | The booking tool | Round robin over the 14 designers, skipping anyone with no free slot, never on top of an existing visit or meeting. |
| The Telegram message to the designer, and the confirmation to the caller | **Chayya**, automatically after booking | Saved in `messages`. Telegram is sent for real. The WhatsApp confirmation to the caller is saved but not sent, because no WhatsApp provider is connected yet; the call page marks it "not sent yet". |
| Lead status (accepted, called, held, proposal, won, lost) | The designer | One tap on the lead, on the dashboard, or on the Telegram message buttons. Every change is logged with who and when. |
| A **project** | The designer | When a lead is **won**, "Start project" on the lead or on My projects. The customer name, phone, area, scope and size are copied from the call. The designer adds the site address, value, and dates. |
| **Site photos** | The designer | Project, Site photos, "Add site photos". On a phone it opens the camera or gallery. Photos are shrunk in the browser and stored in the database (`files`). |
| **Designs** (plans, renders, material boards, PDFs) | The designer | Project, Designs, "Upload a design". Uploading the same title again saves the next version. |
| Project stage and progress | The designer | Tap the stage path, or "Update project". |
| Site visits, design reviews, client meetings, showroom trips | The designer | Project, Overview, "Schedule a visit or meeting". It cannot overlap anything on the calendar, so Chayya never books a new enquiry on top of it. |
| Calls the agent could not finish (escalations, missed calls, declines to check) | Chayya, then any designer acts on them | Shown under Needs attention. Escalations also alert on Telegram. A designer can reverse a wrong decline, which books the caller as a hot lead. |

## Checks on uploads
Files are checked by their contents, not their label (JPG, PNG, WebP, and PDF for designs only). SVG is refused because it can carry scripts.
Maximum 2.5 MB each. Only the designer who owns the project can see or change its files.

## The demo data
So the screens are not empty before real work arrives, the database holds dummy data: 44 ongoing projects across the 14 designers
(Aryan has five at every stage), 30 open leads, 11 calls the agent could not book, each designer's calendar, transcripts, designs,
site photos and Chayya's messages. All names, numbers and addresses are made up. Site photos are free stock photos from Pexels
(see `public/photos/CREDITS.md`) and the drawings are generated. Every row is flagged `is_demo`.

```
npm run seed:demo                        # (re)create the demo data, dated from today
node scripts/seed-demo.js --remove       # delete only the demo rows; real data is untouched
```
