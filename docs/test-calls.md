# Test calls and answer key

Use the 20 phone transcripts (T01 to T20) as scripts: read the caller's lines to the agent and check what it does. The key below is my reading of `qualified.md` and `services.md`. **Nikhil should confirm it** before it counts as the official answer.

**Pass mark: zero wrongful declines.** Every call marked "book" must be booked. Declines are allowed only where marked.

| Call | Caller | Expected outcome | Check |
|---|---|---|---|
| T01 | Priya, 3BHK Kothrud, referral | Book, priority | Referral captured; husband agrees counts as decision-maker |
| T02 | 2BHK Wakad, asks for a ballpark | Book | Price asked twice: deflect both times, never a number |
| T03 | Home office in Nashik | Decline | Read-back "Nashik?" before declining |
| T04 | Colours and furniture ideas only | Decline | Advice only; invite to call back for a full project |
| T05 | 4BHK Koregaon Park, 2,400 sq ft, referral | Book, hot | Large project |
| T06 | Startup office Baner, 800 sq ft | Book | Founder is the decision-maker |
| T07 | Living room and kitchen before Diwali, 3 weeks | Decline for timing, offer later start | Must offer a later date, not just refuse |
| T08 | Missed call at 10:47 pm | The agent answers it | After-hours: normal flow |
| T09 | Angry client, designer silent 5 days | Escalate | Callback in 15 minutes from someone senior; not logged as a new lead |
| T10 | Kitchen and bedroom, budget 1 to 1.5 lakh | Decline | Agent did not ask the budget; responded only because it was volunteered |
| T11 | Rented 2BHK Baner | Book | Rented flat does not disqualify |
| T12 | Villa 5,500 sq ft Kalyani Nagar | Book, hot | Large project |
| T13 | 3BHK Aundh, pushes for a range | Book | Deflect without a number |
| T14 | Son calling for parents, Hadapsar | Book | Parents decide and will attend; note it |
| T15 | Possession in six weeks, 2BHK Undri | Book, hot | Short lead time but within the studio's limit |
| T16 | Called Monday, nobody called back | Book, hot | previous_failed_contact set; apologise |
| T17 | Line drops, rings again | Book | Does not restart the conversation |
| T18 | 180 sq ft coworking pod | Book with a flag | The written rules have no size minimum, so the agent forwards it. The human front desk declined it. Ask Nikhil. |
| T19 | Restaurant in Koregaon Park | Decline | Outside what the studio does |
| T20 | 2BHK Magarpatta, January start | Book | Clean qualified call |

## Extra calls to try (made up, to stress the risky parts)
1. **Mishearing:** "Wakad" said unclearly. The agent must ask again, never guess.
2. **Area not on the list:** "Kharadi". `check_area` returns unknown; the agent must book with a flag, not decline.
3. **Price pushed three times** in a row. No number at any point.
4. **"I'm just researching for my in-laws."** The agent asks whether they will join the consultation.
5. **High budget** ("around 40 lakh"). No effect on qualification.
6. **Hinglish** caller from start to finish.
7. **"Are you a robot?"** An honest answer.
8. **Caller refuses to give a phone number.** The agent explains it is needed for the designer's call and does not book without one.
9. **Rings back after a decline** saying the site is in Pune after all.
