// Replays the 20 phone transcripts through the tool endpoints, the way the voice agent would call them.
import { readFileSync, existsSync } from 'node:fs';

if (existsSync('.env')) for (const l of readFileSync('.env', 'utf8').split('\n')) { const m = /^([A-Z_]+)=(.*)$/.exec(l.trim()); if (m && m[2]) process.env[m[1]] ??= m[2].replace(/^(["'])(.*)\1$/, '$2'); }
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const post = (p, body) => fetch(`${BASE}${p}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.AGENT_API_KEY }, body: JSON.stringify(body) }).then((r) => r.json());

const book = (id, name, f) => ({ kind: 'book', id, name, f: { caller_phone: '+91 90000 0' + id.slice(1).padStart(4, '0'), ...f } });
const decline = (id, name, area, reason, extra = {}) => ({ kind: 'decline', id, name, area, reason, extra });
const calls = [
  book('T01', 'Priya', { project_type: '3BHK full home', area: 'Kothrud, Dahanukar Colony', size_sqft: 1400, start_within_weeks: 26, full_scope: true, referral: true, source: 'referral: Shruti Joshi', decision_maker: 'owner, husband agrees' }),
  book('T02', 'Caller', { project_type: '2BHK full home', area: 'Wakad', size_sqft: 950, start_within_weeks: 4, full_scope: true, source: 'Instagram', summary: 'Asked for a price range twice; deflected.' }),
  decline('T03', 'Suresh Patil', 'Nashik', 'outside service area: caller said Nashik (read back and confirmed)'),
  decline('T04', 'Caller', '', 'advice only: wants colour and furniture ideas, no execution'),
  book('T05', 'Aarti Mehta', { project_type: '4BHK full home', area: 'Koregaon Park', size_sqft: 2400, start_within_weeks: 17, full_scope: true, referral: true, source: 'referral: Vikram Agarwal' }),
  book('T06', 'Startup founder', { project_type: 'office fitout', area: 'Baner', size_sqft: 800, start_within_weeks: 12, full_scope: true, decision_maker: 'founder' }),
  decline('T07', 'Caller', 'Pune', 'timeline: wants living room and kitchen done before Diwali, three weeks away; later start offered'),
  { kind: 'missed', id: 'T08', phone: '+91 90000 00008' },
  { kind: 'escalate', id: 'T09', name: 'Sheetal Deshpande', summary: 'Existing client, 2BHK Viman Nagar. Designer Aryan silent for 5 days. Wants Nikhil or a senior person to call back.' },
  decline('T10', 'Caller', 'Kharadi', 'budget far below scope: volunteered 1 to 1.5 lakh for kitchen and bedroom with execution'),
  book('T11', 'Caller', { project_type: '2BHK rented, living room, bedroom, kitchen', area: 'Baner', source: 'unknown', summary: 'Rented flat, landlord agrees, no structural changes.' }),
  book('T12', 'Anand Sharma', { project_type: 'villa full design', area: 'Kalyani Nagar', size_sqft: 5500, start_within_weeks: 24, full_scope: true }),
  book('T13', 'Caller', { project_type: '3BHK kitchen, wardrobes, living room', area: 'Aundh', size_sqft: 1100, summary: 'Pushed for a price range; deflected.' }),
  book('T14', 'Caller (son)', { project_type: '3BHK full design, new possession', area: 'Hadapsar', decision_maker: 'parents decide; both will attend consultation', summary: 'Son is doing initial check.' }),
  book('T15', 'Smita', { project_type: '2BHK full home', area: 'Undri', size_sqft: 875, start_within_weeks: 6, full_scope: true, decision_maker: 'owner, husband agrees' }),
  book('T16', 'Girish Nair', { project_type: '3BHK', area: 'Viman Nagar', previous_failed_contact: true, summary: 'Called Monday, nobody called back. Apologise.' }),
  book('T17', 'Ritu Kapoor', { project_type: '3BHK kitchen, wardrobes, living room', area: 'Pimple Saudagar', size_sqft: 1050, start_within_weeks: 24, summary: 'First call dropped; called back.' }),
  book('T18', 'Coworking owner', { project_type: 'office pod', area: 'Pune', size_sqft: 180, summary: 'Very small office (180 sq ft). Written rules have no size minimum; flagged for Nikhil.' }),
  decline('T19', 'Caller', 'Koregaon Park', 'outside what the studio does: restaurant interiors'),
  book('T20', 'Pooja', { project_type: '2BHK full home', area: 'Magarpatta', size_sqft: 900, start_within_weeks: 12, full_scope: true, decision_maker: 'owner, husband agrees' }),
];

const run = Date.now().toString(36);
const rows = [];
for (const c of calls) {
  const call_id = `sim-${run}-${c.id}`;
  if (c.kind === 'book') {
    const area = await post('/api/check-area', { area: c.f.area });
    const r = await post('/api/book', { call_id, caller_name: c.name, ...c.f });
    rows.push([c.id, `book (${area.status})`, r.tier || '-', r.designer || '-', r.spoken || JSON.stringify(r)]);
  } else if (c.kind === 'decline') {
    const area = c.area ? await post('/api/check-area', { area: c.area }) : { status: '-' };
    await post('/api/log-call', { call_id, outcome: 'declined', decline_reason: c.reason, caller_name: c.name, area: c.area, summary: c.reason });
    rows.push([c.id, `decline (area ${area.status})`, '-', '-', c.reason]);
  } else if (c.kind === 'escalate') {
    await post('/api/log-call', { call_id, outcome: 'escalated', caller_name: c.name, summary: c.summary });
    rows.push([c.id, 'escalate', '-', '-', c.summary.slice(0, 70)]);
  } else {
    await post('/api/log-call', { call_id, outcome: 'missed', caller_phone: c.phone });
    rows.push([c.id, 'missed (callback)', '-', '-', 'after-hours missed call']);
  }
}
for (const r of rows) console.log(r.map((x, i) => String(x).padEnd([5, 22, 9, 9, 0][i])).join(' '));
