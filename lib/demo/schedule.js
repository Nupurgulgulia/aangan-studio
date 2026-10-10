// Builds each designer's calendar for yesterday and the next seven days: site visits, design reviews, client meetings,
// showroom trips, measurements, handovers, and the consultations for their open leads. Nothing overlaps, there is a
// 30 minute gap for travel after anything off-site, and every designer keeps plenty of free time for new leads.
import { DEFAULT_HOURS, startOfISTDay, toIST } from '../time.js';

const MIN = 60000, DAY = 86400000, SLOT = 30;
const OPEN = 10 * 60, CLOSE = 19 * 60;

const SHOWROOMS = {
  'flooring and tiles': ['Tile and stone showroom, Baner Road', 'Tile gallery, Nagar Road', 'Stone and tile studio, Karve Road'],
  'laminates and veneers': ['Laminates dealer, Bhosari', 'Veneer and plywood warehouse, Hadapsar', 'Surfaces showroom, Kothrud'],
  lighting: ['Lighting showroom, FC Road', 'Decor lighting studio, Aundh', 'Lights and fans store, Camp'],
  sanitaryware: ['Bath fittings gallery, Pune-Satara Road', 'Sanitaryware showroom, Wakad'],
  'hardware and fittings': ['Hardware market, Budhwar Peth', 'Fittings centre, Pimpri'],
  'curtains and blinds': ['Fabric studio, Koregaon Park', 'Curtains and blinds showroom, Viman Nagar'],
};

const surname = (full) => String(full).replace(/^(Dr|Fr)\s+/i, '').split(/\s+/).pop();
const days = (now) => {
  const today = startOfISTDay(now).getTime();
  const out = [];
  for (let k = -1; k <= 7; k++) { const ms = today + k * DAY; if (toIST(new Date(ms + 12 * 3600e3)).weekday !== 0) out.push({ k, ms }); }
  return out;
};
const hoursFor = (ms) => DEFAULT_HOURS[toIST(new Date(ms + 12 * 3600e3)).weekday];

function weighted(rng, pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[0][0];
}

const MANDATORY = {
  design: ['design_review', 'client_meeting'],
  approvals: ['client_meeting', 'vendor'],
  execution: ['site_visit', 'site_visit', 'vendor'],
  finishing: ['site_visit', 'vendor'],
  handover: ['handover', 'site_visit'],
};
const EXTRA = {
  design: [['design_review', 3], ['client_meeting', 2], ['vendor', 2], ['measurement', 1]],
  approvals: [['client_meeting', 3], ['design_review', 2], ['vendor', 2]],
  execution: [['site_visit', 5], ['vendor', 2], ['client_meeting', 1], ['design_review', 1]],
  finishing: [['site_visit', 4], ['vendor', 2], ['client_meeting', 1]],
  handover: [['site_visit', 2], ['client_meeting', 1]],
};
const CLIENT_MEETING = { design: 'Concept presentation', approvals: 'Layout sign-off', execution: 'Progress review', finishing: 'Snag walk-through', handover: 'Final payment and handover papers' };
const DURATION = { site_visit: [90, 120], design_review: [60, 60], client_meeting: [60, 60], vendor: [120, 120], measurement: [90, 90], handover: [120, 120], consultation: [30, 30] };

function describe(kind, p, rng) {
  const name = surname(p.customer_name);
  const where = `${p.society}, ${p.area}`;
  if (kind === 'site_visit') return { title: `Site visit · ${name}`, location: where };
  if (kind === 'design_review') return { title: `Design review · ${name} ${p.type.split(' ')[0]}`, location: 'Aangan Studio' };
  if (kind === 'client_meeting') {
    const place = rng.pick(['Aangan Studio', 'Aangan Studio', where, 'Video call']);
    return { title: `${CLIENT_MEETING[p.stage]} · ${name}`, location: place };
  }
  if (kind === 'vendor') {
    const thing = rng.pick(Object.keys(SHOWROOMS));
    return { title: `Showroom: ${thing} · ${name}`, location: rng.pick(SHOWROOMS[thing]) };
  }
  if (kind === 'measurement') return { title: `Site measurement · ${name}`, location: where };
  if (kind === 'handover') return { title: `Handover walkthrough · ${name}`, location: where };
  return { title: kind, location: '' };
}

// designers: names in rotation order. projects/leads: arrays with .designer, plus .code / .key.
export function buildCalendar({ now, designers, projects, leads, rng }) {
  const dayList = days(now);
  const events = [];
  const consult = new Map(); // lead key -> start ms
  const nowMs = now.getTime();

  for (const designer of designers) {
    const busy = [];
    const free = (start, end, off) => busy.every(([s, e]) => end + (off ? 30 * MIN : 0) <= s || start >= e);
    const mine = projects.filter((p) => p.designer === designer);
    const myLeads = leads.filter((l) => l.designer === designer);

    // Aryan's first working morning is kept clear so the live walk-through call can be booked straight into it.
    if (designer === 'Aryan') {
      const first = dayList.find((d) => d.ms + OPEN * MIN > nowMs + 30 * MIN);
      if (first) busy.push([first.ms + OPEN * MIN, first.ms + (OPEN + 90) * MIN]);
    }

    const place = (kind, dayMs, project, preferred) => {
      const h = hoursFor(dayMs);
      if (!h) return null;
      const dur = rng.pick(DURATION[kind]);
      const off = !['design_review', 'consultation'].includes(kind);
      const starts = [];
      for (let m = Math.max(OPEN, h[0]); m + dur <= Math.min(CLOSE, h[1]); m += SLOT) starts.push(m);
      for (const m of rng.shuffle(preferred ? preferred.filter((x) => starts.includes(x)).concat(starts) : starts)) {
        const start = dayMs + m * MIN, end = start + dur * MIN;
        if (end < nowMs - DAY * 2) continue;
        if (!free(start, end, off)) continue;
        busy.push([start, end + (off ? 30 * MIN : 0)]);
        return { start, end };
      }
      return null;
    };

    // Open leads: the consultation is booked, as the agent would have done on the call.
    for (const l of myLeads) {
      if (['held', 'proposal'].includes(l.status)) continue;
      const upcoming = dayList.filter((d) => d.ms + CLOSE * MIN > nowMs + 2 * 3600e3);
      const dayIdx = l.status === 'new' ? 0 : rng.int(0, 2);
      for (let tries = 0; tries < 6; tries++) {
        const day = upcoming[Math.min(upcoming.length - 1, dayIdx + tries)];
        const slot = place('consultation', day.ms, null, [10 * 60 + 30, 11 * 60, 11 * 60 + 30, 15 * 60, 16 * 60]);
        if (slot && slot.start > nowMs + 30 * MIN) { consult.set(l.key, slot.start); events.push({ designer, kind: 'consultation', leadKey: l.key, start: slot.start, end: slot.end }); break; }
        if (slot) busy.pop();
      }
    }

    // Each project gets the visits and meetings its stage calls for, spread over the week.
    for (const p of mine) {
      for (const kind of MANDATORY[p.stage]) {
        const pool = rng.shuffle(dayList);
        for (const d of pool) {
          if (d.k < 0 && !rng.chance(0.5)) continue;
          const slot = place(kind, d.ms, p, kind === 'site_visit' ? [10 * 60, 10 * 60 + 30, 15 * 60] : null);
          if (slot) { events.push({ designer, kind, projectCode: p.code, start: slot.start, end: slot.end, ...describe(kind, p, rng) }); break; }
        }
      }
    }

    // Top up with a couple of extras so the week looks lived in.
    const extras = rng.int(1, 3);
    for (let i = 0; i < extras && mine.length; i++) {
      const p = rng.pick(mine);
      const kind = weighted(rng, EXTRA[p.stage]);
      const d = rng.pick(dayList);
      const slot = place(kind, d.ms, p, null);
      if (slot) events.push({ designer, kind, projectCode: p.code, start: slot.start, end: slot.end, ...describe(kind, p, rng) });
    }
  }
  events.sort((a, b) => a.start - b.start);
  return { events, consult };
}
