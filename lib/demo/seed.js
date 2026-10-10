// Writes the demo data: 44 ongoing projects across the 14 designers, open leads, the calls the agent could not book,
// each designer's calendar, design drawings, site photos, call transcripts, and Chayya's messages.
// Everything is flagged is_demo so removeDemo() takes it out again without touching real rows.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PROJECTS, LEADS, OTHER_CALLS, SOCIETIES, PINCODES } from './spec.js';
import { rngFrom, slug, firstName } from './util.js';
import { bookedTranscript, leadSummary, otherCall, projectUpdate, timelineText } from './text.js';
import { floorPlanSvg, kitchenElevationSvg, materialBoardSvg, planKey } from './svg.js';
import { buildCalendar } from './schedule.js';
import { scoreLead, callByDeadline } from '../tiers.js';
import { speakSlot } from '../time.js';
import { formatHandoff, formatWhen } from '../notify.js';
import { customerConfirmation, customerReminder, designerReminder } from '../chayya.js';

const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const dateOnly = (ms) => new Date(ms + 330 * MIN).toISOString().slice(0, 10);

const PHOTOS = {
  living: [6588599, 7060814, 6933852, 20390760, 1643383, 6934189, 6523291, 6312353],
  kitchen: [1643384, 6903160, 7031213, 7018399, 6538903],
  bedroom: [15404863, 17495861],
  bathroom: [16113325, 11701114, 6436770, 6957087, 7005268, 6956840, 8082194, 5825561, 18246436],
  office: [36631701, 28715052, 18033178, 3778619],
  renovation: [15798784, 5691533, 5691507, 5691530, 15798781, 5317154],
  tiling: [29181494],
  electrical: [5691590, 3614762],
  painting: [5493653, 6474471, 18369835, 7218011, 5691592, 7218006, 5583116, 5799043, 5799084],
  carpentry: [27520661, 28513061],
  ceiling: [6474343],
  building: [12826230, 10209711, 7953124],
};
const photo = (pool, i) => `/photos/${pool}-${PHOTOS[pool][Math.abs(i) % PHOTOS[pool].length]}.jpg`;

const DECISIONS = ['owner, spouse agrees and will attend the consultation', 'husband and wife decide together, both will attend', 'owner decides; the family will join the consultation', 'son is coordinating; parents will attend and decide'];
const STAGE = {
  design: { since: [1, 3], progress: [8, 30], finish: [13, 17] },
  approvals: { since: [3, 5], progress: [28, 40], finish: [11, 15] },
  execution: { since: [6, 11], progress: [42, 78], finish: [4, 9] },
  finishing: { since: [12, 15], progress: [80, 92], finish: [1, 3] },
  handover: { since: [15, 19], progress: [93, 99], finish: [0, 1] },
};

async function insertMany(db, table, cols, rows, returning = '') {
  const out = [];
  for (let i = 0; i < rows.length; i += 80) {
    const params = [];
    const tuples = rows.slice(i, i + 80).map((r) => `(${cols.map((c) => { params.push(r[c] ?? null); return `$${params.length}`; }).join(',')})`);
    const res = await db.query(`insert into ${table} (${cols.join(',')}) values ${tuples.join(',')}${returning ? ` returning ${returning}` : ''}`, params);
    out.push(...res);
  }
  return out;
}

export async function removeDemo(db) {
  await db.query('delete from bookings where is_demo');
  await db.query('delete from messages where is_demo');
  await db.query('delete from projects where is_demo');
  await db.query('delete from status_events where call_id in (select id from calls where is_demo)');
  const gone = await db.query('delete from calls where is_demo returning id');
  return gone.length;
}

// The drawings and photos a project has reached by its stage.
function designsFor(p, rng) {
  const office = planKey(p.type) === 'office';
  const out = [];
  const add = (title, kind, version, status, image, daysAfterStart) => out.push({ title, kind, version, status, image, shared_on: dateOnly(p.startMs + daysAfterStart * DAY) });
  const stageOrder = ['design', 'approvals', 'execution', 'finishing', 'handover'].indexOf(p.stage);
  const plan = (v, status, d) => add(`${office ? 'Workstation and cabin layout' : 'Furnished floor plan'}`, 'layout', v, status, { svg: 'layout', version: v }, d);
  if (stageOrder === 0) {
    plan(1, 'shared', 5);
    if (p.progress >= 18) plan(2, 'revision', 12);
    add(office ? 'Reception and workspace concept (reference)' : 'Living room concept (reference)', 'concept', 1, 'shared', { photo: photo(office ? 'office' : 'living', p.i) }, 9);
    add('Material board', 'material_board', 1, 'draft', { svg: 'material', version: 1 }, 14);
  } else if (stageOrder === 1) {
    plan(2, 'shared', 8); plan(3, 'approved', 17);
    add(office ? 'Reception and workspace concept (reference)' : 'Living room concept (reference)', 'concept', 1, 'approved', { photo: photo(office ? 'office' : 'living', p.i) }, 12);
    if (!office) add('Kitchen concept (reference)', 'concept', 1, 'shared', { photo: photo('kitchen', p.i) }, 16);
    add('Material board', 'material_board', 2, 'shared', { svg: 'material', version: 2 }, 20);
    if (!office) add('Kitchen elevation', 'elevation', 1, 'shared', { svg: 'elevation', version: 1 }, 22);
  } else {
    plan(4, 'approved', 20);
    add(office ? 'Reception and workspace concept (reference)' : 'Living room concept (reference)', 'concept', 2, 'approved', { photo: photo(office ? 'office' : 'living', p.i + 2) }, 18);
    if (!office) { add('Master bedroom concept (reference)', 'concept', 1, 'approved', { photo: photo('bedroom', p.i) }, 21); add('Kitchen elevation', 'elevation', 2, 'approved', { svg: 'elevation', version: 2 }, 24); }
    add('Material board', 'material_board', 3, 'approved', { svg: 'material', version: 3 }, 26);
  }
  return out;
}

const SITE_STAGES = [
  ['civil', 'renovation', 'Civil work: old finishes removed and walls prepared'],
  ['electrical', 'electrical', 'Electrical: concealed wiring and switch points marked'],
  ['ceiling', 'ceiling', 'False ceiling: gypsum boards and framework going up'],
  ['tiling', 'tiling', 'Flooring: vitrified tiles being laid and levelled'],
  ['carpentry', 'carpentry', 'Carpentry: wardrobes and kitchen carcass work at the workshop'],
  ['painting', 'painting', 'Painting: putty, primer and first coat in progress'],
];
function photosFor(p, rng, nowMs) {
  const out = [];
  const span = Math.max(7, (nowMs - p.startMs) / DAY);
  const at = (frac) => dateOnly(p.startMs + Math.min(span, span * frac) * DAY);
  const add = (caption, stage, image, frac) => out.push({ caption, stage, image, taken_on: at(frac) });
  add('Site check: the building and the entrance lobby', 'site_check', photo('building', p.i), 0.02);
  add('Site measurement day: bare flat, existing points and walls marked', 'site_check', photo('renovation', p.i), 0.04);
  const order = ['design', 'approvals', 'execution', 'finishing', 'handover'].indexOf(p.stage);
  if (order >= 2) {
    const reached = Math.max(1, Math.min(SITE_STAGES.length, Math.round(((p.progress - 38) / 42) * SITE_STAGES.length) + 1));
    SITE_STAGES.slice(0, order >= 3 ? SITE_STAGES.length : reached).forEach(([stage, pool, caption], k) => {
      add(caption, stage, photo(pool, p.i + k), 0.2 + (k + 1) * 0.12);
      if (PHOTOS[pool].length > 1 && rng.chance(0.6)) add(`${caption.split(':')[0]}: progress after two more days`, stage, photo(pool, p.i + k + 1), 0.22 + (k + 1) * 0.12);
    });
  }
  const office = planKey(p.type) === 'office';
  if (order >= 3) {
    add(office ? 'Workspace: furniture and lighting going in' : 'Living room: furniture in place, styling pending', 'finishing', photo(office ? 'office' : 'living', p.i + 1), 0.9);
    if (!office) add('Kitchen: shutters, counter and hob installed', 'finishing', photo('kitchen', p.i + 1), 0.92);
  }
  if (order >= 4) {
    if (!office) { add('Master bedroom: wardrobe and bed wall complete', 'handover', photo('bedroom', p.i + 1), 0.96); add('Bathroom: fittings installed, final cleaning done', 'handover', photo('bathroom', p.i), 0.97); }
    add(office ? 'Workspace: ready for handover' : 'Living and dining: ready for handover', 'handover', photo(office ? 'office' : 'living', p.i + 3), 0.99);
  }
  return out.sort((a, b) => a.taken_on.localeCompare(b.taken_on));
}

export async function seedDemo(db, { now = new Date(), designsDir = null, seed = 7 } = {}) {
  const removed = await removeDemo(db);
  const rng = rngFrom(seed);
  const nowMs = now.getTime();
  const designerRows = await db.query('select id, name from designers order by rr_order');
  const designerId = Object.fromEntries(designerRows.map((d) => [d.name, d.id]));
  const designerNames = designerRows.map((d) => d.name);
  const year = new Date(nowMs + 330 * MIN).getUTCFullYear();

  /* ---- projects ---- */
  const usedSocieties = rng.shuffle(SOCIETIES);
  const projects = PROJECTS.map(([designer, customer, area, type, size, stage, value, source, notes], i) => {
    const st = STAGE[stage];
    const startMs = nowMs - rng.int(...st.since) * 7 * DAY - rng.int(0, 5) * DAY;
    const society = usedSocieties[i % usedSocieties.length];
    const wing = rng.pick(['A', 'B', 'C', 'D']);
    const flat = `${wing}-${rng.int(2, 14)}0${rng.int(1, 6)}`;
    const targetMs = nowMs + (stage === 'handover' ? rng.int(2, 9) * DAY : rng.int(...st.finish) * 7 * DAY);
    const office = /office/.test(type), villa = /villa/.test(type);
    const surname = customer.replace(/^(Dr|Fr)\s+/, '').split(' ').pop();
    return {
      i, code: `AS-${year}-${String(i + 1).padStart(3, '0')}`, designer, customer_name: customer, customer_phone: `+91 90000 ${10001 + i}`, area, society,
      site_address: `${villa ? 'Plot' : 'Flat'} ${flat}, ${society}, ${area}, Pune ${PINCODES[area] || '411001'}`,
      type, size_sqft: size, stage, progress: rng.int(...st.progress), startMs, targetMs, value_lakh: value, source, notes,
      name: `${surname} ${office ? 'office' : villa ? 'villa' : 'residence'}`,
      weeks: rng.int(12, 26), decision: rng.pick(DECISIONS), referral: source.startsWith('referral'),
    };
  });

  /* ---- open leads ---- */
  const leads = LEADS.map(([designer, name, area, type, size, status, hoursAgo, referral, weeks, source], i) => {
    const createdMs = nowMs - hoursAgo * HOUR;
    const lead = { project_type: type, size_sqft: size, start_within_weeks: weeks, full_scope: true, referral };
    const { tier, reasons } = scoreLead(lead);
    return {
      key: `lead-${i}`, designer, name, area, type, size, status, createdMs, weeks, referral, source, phone: `+91 90000 ${20001 + i}`,
      tier, reasons, callByMs: callByDeadline(new Date(createdMs), tier).getTime(), decision: rng.pick(DECISIONS),
    };
  });

  const { events, consult } = buildCalendar({ now, designers: designerNames, projects, leads, rng });

  /* ---- call rows ---- */
  const callRows = [];
  const style = () => (rng.chance(0.3) ? 'hinglish' : 'en');
  const duration = () => rng.int(150, 330);
  const cost = (d) => Math.round((d / 60) * 7.5 * 100) / 100;
  const byCallId = new Map();
  const statusChain = (finalStatus, fromMs, designer) => {
    const chain = ['new', 'accepted', 'called', 'held', 'proposal', 'won'];
    const upto = chain.indexOf(finalStatus);
    let t = fromMs;
    const gaps = [0, 25 * MIN, 3 * HOUR, 3 * DAY, 6 * DAY, 8 * DAY];
    return chain.slice(0, upto + 1).map((s, k) => { t += gaps[k] + rng.int(0, 20) * MIN; return { status: s, ms: t, note: s === 'new' ? 'Booked by Chayya on the call' : `${rng.chance(0.6) ? 'via Telegram' : 'via dashboard'} by ${designer}` }; });
  };

  for (const p of projects) {
    const createdMs = p.startMs - rng.int(12, 20) * DAY;
    const lead = { project_type: p.type, size_sqft: p.size_sqft, start_within_weeks: p.weeks, full_scope: true, referral: p.referral };
    const { tier, reasons } = scoreLead(lead);
    const d = duration();
    p.callId = `demo-${p.code}`;
    p.createdMs = createdMs;
    p.tier = tier; p.reasons = reasons;
    p.slotMs = createdMs + 26 * HOUR;
    p.chain = statusChain('won', createdMs, p.designer);
    const lc = { name: p.customer_name, phone: p.customer_phone, area: p.area, type: p.type, size: p.size_sqft, weeks: p.weeks, referral: p.referral, source: p.source, decision: p.decision, notes: p.notes };
    p.lc = lc;
    callRows.push({
      call_id: p.callId, created_at: iso(createdMs), caller_name: p.customer_name, caller_phone: p.customer_phone, project_type: p.type, area: p.area, size_sqft: p.size_sqft,
      timeline_text: timelineText(p.weeks), decision_maker: p.decision, source: p.source, budget_note: 'not stated', outcome: 'qualified', tier, tier_reasons: reasons.join('; '),
      call_by: iso(callByDeadline(new Date(createdMs), tier).getTime()), designer_id: designerId[p.designer], slot_start: iso(p.slotMs), window_missed: false, status: 'won',
      summary: leadSummary(lc), transcript: bookedTranscript(lc, p.designer, speakSlot(new Date(p.slotMs), new Date(createdMs)), style(), rng), duration_sec: d, cost_inr: cost(d), reviewed: false, is_demo: true,
    });
  }

  for (const l of leads) {
    const slotMs = consult.get(l.key) ?? l.createdMs + rng.int(30, 50) * HOUR;
    l.slotMs = slotMs;
    l.callId = `demo-${l.key}`;
    const d = duration();
    const lc = { name: l.name, phone: l.phone, area: l.area, type: l.type, size: l.size, weeks: l.weeks, referral: l.referral, source: l.source, decision: l.decision };
    l.lc = lc;
    l.chain = statusChain(l.status, l.createdMs, l.designer).map((c, k, a) => ({ ...c, ms: Math.min(c.ms, nowMs - (a.length - k) * 5 * MIN) }));
    callRows.push({
      call_id: l.callId, created_at: iso(l.createdMs), caller_name: l.name, caller_phone: l.phone, project_type: l.type, area: l.area, size_sqft: l.size, timeline_text: timelineText(l.weeks),
      decision_maker: l.decision, source: l.source, budget_note: 'not stated', outcome: 'qualified', tier: l.tier, tier_reasons: l.reasons.join('; '), call_by: iso(l.callByMs),
      designer_id: designerId[l.designer], slot_start: iso(slotMs), window_missed: false, status: l.status, summary: leadSummary(lc),
      transcript: bookedTranscript(lc, l.designer, speakSlot(new Date(slotMs), new Date(l.createdMs)), style(), rng), duration_sec: d, cost_inr: cost(d), reviewed: false, is_demo: true,
    });
  }

  const others = OTHER_CALLS.map((c, i) => {
    const createdMs = nowMs - c.minutesAgo * MIN;
    const text = otherCall(c);
    const d = c.outcome === 'missed' ? 8 : rng.int(60, 140);
    const row = {
      call_id: `demo-other-${i}`, created_at: iso(createdMs), caller_name: c.name, caller_phone: `+91 90000 ${30001 + i}`, project_type: c.type, area: c.area, outcome: c.outcome,
      decline_reason: text.reason ?? null, summary: text.summary, transcript: text.transcript, duration_sec: d, cost_inr: cost(d), status: c.done ? 'done' : 'new', reviewed: c.reviewed === true, is_demo: true,
    };
    callRows.push(row);
    return { ...c, row, createdMs, callId: row.call_id };
  });

  const COLS = ['call_id', 'created_at', 'caller_name', 'caller_phone', 'project_type', 'area', 'size_sqft', 'timeline_text', 'decision_maker', 'source', 'budget_note', 'outcome', 'decline_reason', 'tier', 'tier_reasons',
    'call_by', 'designer_id', 'slot_start', 'window_missed', 'status', 'summary', 'transcript', 'duration_sec', 'cost_inr', 'reviewed', 'is_demo'];
  const defaults = { window_missed: false, status: 'new', reviewed: false, is_demo: true };
  const inserted = await insertMany(db, 'calls', COLS, callRows.map((r) => ({ ...defaults, ...r })), 'id, call_id');
  for (const r of inserted) byCallId.set(r.call_id, r.id);

  /* ---- status history ---- */
  const events2 = [];
  for (const x of [...projects, ...leads]) for (const c of x.chain) events2.push({ call_id: byCallId.get(x.callId), status: c.status, note: c.note, created_at: iso(c.ms) });
  await insertMany(db, 'status_events', ['call_id', 'status', 'note', 'created_at'], events2);

  /* ---- projects, designs, photos ---- */
  const projRows = projects.map((p) => {
    const photos = photosFor(p, rng, nowMs);
    p.photos = photos;
    const hero = ['finishing', 'handover'].includes(p.stage) ? photos[photos.length - 1].image : ['design', 'approvals'].includes(p.stage) ? photo('building', p.i) : photos[photos.length - 1].image;
    return {
      code: p.code, call_id: byCallId.get(p.callId), designer_id: designerId[p.designer], name: p.name, customer_name: p.customer_name, customer_phone: p.customer_phone, area: p.area,
      site_address: p.site_address, project_type: p.type, size_sqft: p.size_sqft, stage: p.stage, progress_pct: p.progress, start_date: dateOnly(p.startMs), target_date: dateOnly(p.targetMs),
      value_lakh: p.value_lakh, summary: p.notes, hero_photo: hero, is_demo: true, created_at: iso(p.createdMs + 3 * DAY),
    };
  });
  const projIds = Object.fromEntries((await insertMany(db, 'projects', ['code', 'call_id', 'designer_id', 'name', 'customer_name', 'customer_phone', 'area', 'site_address', 'project_type', 'size_sqft', 'stage',
    'progress_pct', 'start_date', 'target_date', 'value_lakh', 'summary', 'hero_photo', 'is_demo', 'created_at'], projRows, 'id, code')).map((r) => [r.code, r.id]));

  const designRows = [], photoRows = [], files = new Map();
  for (const p of projects) {
    const r = rngFrom(seed * 1000 + p.i);
    for (const d of designsFor(p, r)) {
      let image;
      if (d.image.photo) image = d.image.photo;
      else {
        const file = `${slug(p.code)}-${d.kind}-v${d.version}.svg`;
        const title = `${p.name}, ${p.area}`;
        const svg = d.image.svg === 'layout' ? floorPlanSvg({ title, subtitle: p.type, type: p.type, sizeSqft: p.size_sqft, version: d.version, rng: rngFrom(seed * 77 + p.i) })
          : d.image.svg === 'material' ? materialBoardSvg({ title, version: d.version, rng: rngFrom(seed * 91 + p.i * 3 + d.version) })
            : kitchenElevationSvg({ title, version: d.version, rng: rngFrom(seed * 53 + p.i * 3 + d.version) });
        files.set(file, svg);
        image = `/designs/${file}`;
      }
      designRows.push({ project_id: projIds[p.code], title: d.title, kind: d.kind, version: d.version, status: d.status, image_path: image, notes: null, shared_on: d.shared_on });
    }
    for (const ph of p.photos) photoRows.push({ project_id: projIds[p.code], caption: ph.caption, stage: ph.stage, taken_on: ph.taken_on, image_path: ph.image });
  }
  await insertMany(db, 'project_designs', ['project_id', 'title', 'kind', 'version', 'status', 'image_path', 'notes', 'shared_on'], designRows);
  await insertMany(db, 'project_photos', ['project_id', 'caption', 'stage', 'taken_on', 'image_path'], photoRows);
  if (designsDir) {
    mkdirSync(designsDir, { recursive: true });
    for (const [file, svg] of files) writeFileSync(path.join(designsDir, file), svg);
  }

  /* ---- calendar ---- */
  const byProjectCode = Object.fromEntries(projects.map((p) => [p.code, p]));
  const byLeadKey = Object.fromEntries(leads.map((l) => [l.key, l]));
  const bookingRows = events.map((e) => {
    if (e.kind === 'consultation') {
      const l = byLeadKey[e.leadKey];
      return { designer_id: designerId[e.designer], call_id: byCallId.get(l.callId), start_at: iso(e.start), end_at: iso(e.end), kind: 'consultation', title: `Consultation · ${l.name}`, project_id: null, location: 'Phone call', is_demo: true };
    }
    return { designer_id: designerId[e.designer], call_id: null, start_at: iso(e.start), end_at: iso(e.end), kind: e.kind, title: e.title, project_id: projIds[e.projectCode], location: e.location, is_demo: true };
  });
  await insertMany(db, 'bookings', ['designer_id', 'call_id', 'start_at', 'end_at', 'kind', 'title', 'project_id', 'location', 'is_demo'], bookingRows);

  /* ---- Chayya's messages ---- */
  const msgs = [];
  const say = (m) => msgs.push({ call_id: null, project_id: null, to_name: null, to_address: null, status: 'sent', note: null, sender: 'Chayya', is_demo: true, ...m });
  const booking = (x) => ({ tier: x.tier, tier_reasons: x.reasons, call_by: new Date(x.callByMs ?? x.createdMs + 24 * HOUR), slot: new Date(x.slotMs), window_missed: false, designer_name: x.designer });
  for (const x of [...projects, ...leads]) {
    const lead = { caller_name: x.lc.name, caller_phone: x.lc.phone, area: x.lc.area, project_type: x.lc.type, size_sqft: x.lc.size, timeline_text: timelineText(x.lc.weeks), decision_maker: x.lc.decision, source: x.lc.source, budget_note: 'not stated', summary: leadSummary(x.lc) };
    const b = booking(x);
    const callRow = byCallId.get(x.callId);
    say({ call_id: callRow, channel: 'telegram', to_name: x.designer, body: formatHandoff(lead, b), created_at: iso(x.createdMs + 90 * 1000) });
    say({ call_id: callRow, channel: 'whatsapp', to_name: x.lc.name, to_address: x.lc.phone, body: customerConfirmation(lead, b), created_at: iso(x.createdMs + 2 * MIN) });
  }
  for (const l of leads) {
    const lead = { caller_name: l.lc.name };
    const reminderMs = l.slotMs - 18 * HOUR;
    if (!['held', 'proposal'].includes(l.status) && reminderMs <= nowMs && l.slotMs > nowMs) {
      say({ call_id: byCallId.get(l.callId), channel: 'whatsapp', to_name: l.name, to_address: l.phone, body: customerReminder(lead, l.designer, `on ${formatWhen(new Date(l.slotMs))}`), created_at: iso(Math.max(reminderMs, l.createdMs + 3 * HOUR)) });
    }
  }
  for (const p of projects) {
    const mine = events.filter((e) => e.projectCode === p.code).sort((a, b) => a.start - b.start);
    const next = mine.find((e) => e.start > nowMs);
    const when = next ? `on ${formatWhen(new Date(next.start))}` : 'this week';
    say({ project_id: projIds[p.code], call_id: byCallId.get(p.callId), channel: 'whatsapp', to_name: p.customer_name, to_address: p.customer_phone, body: projectUpdate({ customer_name: p.customer_name }, p.designer, p.stage, when), created_at: iso(nowMs - rng.int(1, 4) * DAY - rng.int(0, 8) * HOUR) });
    if (['execution', 'finishing', 'handover'].includes(p.stage)) say({ project_id: projIds[p.code], call_id: byCallId.get(p.callId), channel: 'whatsapp', to_name: p.customer_name, to_address: p.customer_phone, body: projectUpdate({ customer_name: p.customer_name }, p.designer, 'execution', 'next week'), created_at: iso(nowMs - rng.int(8, 14) * DAY) });
  }
  for (const e of events.filter((x) => x.designer === 'Aryan' && x.kind !== 'consultation' && x.start > nowMs && x.start < nowMs + 42 * HOUR)) {
    say({ project_id: projIds[e.projectCode], channel: 'telegram', to_name: 'Aryan', body: designerReminder('Aryan', e.title.split(' · ')[0].toLowerCase(), `on ${formatWhen(new Date(e.start))}`, e.location), created_at: iso(Math.min(nowMs - 20 * MIN, e.start - 14 * HOUR)) });
  }
  for (const o of others.filter((x) => x.outcome === 'escalated' && !x.done)) {
    say({ call_id: byCallId.get(o.callId), channel: 'telegram', to_name: 'Studio team', body: `ESCALATION: call back within 15 minutes\n${o.name}\n${o.row.summary}\nOpen "Needs attention" on the dashboard and mark it done after the call.`, created_at: iso(o.createdMs + 60000) });
  }
  await insertMany(db, 'messages', ['call_id', 'project_id', 'channel', 'sender', 'to_name', 'to_address', 'body', 'status', 'note', 'created_at', 'is_demo'], msgs);

  await db.query('update rr_state set next_index = 0 where id = 1');
  return { removed, calls: callRows.length, projects: projects.length, leads: leads.length, bookings: bookingRows.length, designs: designRows.length, photos: photoRows.length, messages: msgs.length, files: files.size };
}
