import { pickDesigner } from './slots.js';
import { callByDeadline, scoreLead } from './tiers.js';
import { speakSlot, SLOT_MINUTES } from './time.js';

const MIN = 60 * 1000;
const iso = (d) => d.toISOString();

export async function getDesigners(db) {
  return db.query('select id, name, rr_order, telegram_chat_id from designers where active order by rr_order');
}

// Every 30-minute slot start that is taken, per designer. A site visit that runs two hours takes four slots.
async function getBooked(db, from, to) {
  const rows = await db.query(
    'select designer_id, start_at, end_at from bookings where end_at > $1 and start_at <= $2',
    [iso(from), iso(to)],
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.designer_id)) map.set(r.designer_id, new Set());
    const taken = map.get(r.designer_id);
    const end = new Date(r.end_at).getTime();
    for (let t = new Date(r.start_at).getTime(); t < end; t += SLOT_MINUTES * MIN) taken.add(t);
  }
  return map;
}

async function existingBooking(db, callId) {
  const rows = await db.query(
    `select c.id, c.tier, c.tier_reasons, c.call_by, c.slot_start, c.window_missed, d.name as designer_name
       from calls c join designers d on d.id = c.designer_id where c.call_id = $1 and c.slot_start is not null`,
    [callId],
  );
  return rows[0] || null;
}

// Qualified lead: score urgency, pick the next designer in rotation with a free slot, book it.
export async function bookLead(db, lead, now = new Date()) {
  if (!lead.call_id) throw new Error('call_id is required');

  const prior = await existingBooking(db, lead.call_id);
  if (prior) {
    return {
      repeated: true,
      call_row_id: prior.id,
      designer_name: prior.designer_name,
      tier: prior.tier,
      call_by: new Date(prior.call_by),
      slot: new Date(prior.slot_start),
      window_missed: prior.window_missed,
      spoken: `${prior.designer_name} will call you ${speakSlot(new Date(prior.slot_start), now)}.`,
    };
  }

  const { tier, reasons } = scoreLead(lead);
  const deadline = callByDeadline(now, tier);
  const designers = await getDesigners(db);

  const inserted = await db.query(
    `insert into calls (call_id, caller_name, caller_phone, project_type, area, size_sqft, timeline_text, decision_maker,
                        source, budget_note, outcome, tier, tier_reasons, call_by, summary)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'qualified',$11,$12,$13,$14)
     on conflict (call_id) do update set outcome = 'qualified', tier = excluded.tier, tier_reasons = excluded.tier_reasons,
       call_by = excluded.call_by, summary = excluded.summary
     returning id`,
    [
      lead.call_id, lead.caller_name || null, lead.caller_phone || null, lead.project_type || null, lead.area || null,
      lead.size_sqft ? Number(lead.size_sqft) : null, lead.timeline_text || null, lead.decision_maker || null,
      lead.source || null, lead.budget_note || 'not stated', tier, reasons.join('; '), iso(deadline), lead.summary || null,
    ],
  );
  const callRowId = inserted[0].id;

  for (let attempt = 0; attempt < 4; attempt++) {
    const state = await db.query('select next_index from rr_state where id = 1');
    const booked = await getBooked(db, now, new Date(now.getTime() + 8 * 24 * 60 * MIN));
    const pick = pickDesigner({
      designers,
      nextIndex: state[0]?.next_index ?? 0,
      now,
      deadline,
      bookedByDesigner: booked,
    });
    if (!pick) break;

    const end = new Date(pick.slot.getTime() + SLOT_MINUTES * MIN);
    const won = await db.query(
      'insert into bookings (designer_id, call_id, start_at, end_at) values ($1,$2,$3,$4) on conflict do nothing returning id',
      [pick.designer.id, callRowId, iso(pick.slot), iso(end)],
    );
    if (!won.length) continue;

    await db.query('update calls set designer_id=$1, slot_start=$2, window_missed=$3 where id=$4', [
      pick.designer.id, iso(pick.slot), pick.windowMissed, callRowId,
    ]);
    await db.query('update rr_state set next_index = $1 where id = 1', [pick.nextIndex]);

    return {
      repeated: false,
      call_row_id: callRowId,
      designer_id: pick.designer.id,
      designer_name: pick.designer.name,
      telegram_chat_id: pick.designer.telegram_chat_id,
      tier,
      tier_reasons: reasons,
      call_by: deadline,
      slot: pick.slot,
      window_missed: pick.windowMissed,
      spoken: `${pick.designer.name} will call you ${speakSlot(pick.slot, now)}.`,
    };
  }
  return { error: 'no_slot', call_row_id: callRowId, tier, call_by: deadline };
}

// Declined, escalated, missed and info-only calls. Declines are kept for the daily review.
export async function logCall(db, data) {
  const rows = await db.query(
    `insert into calls (call_id, caller_name, caller_phone, project_type, area, size_sqft, timeline_text, decision_maker, source,
                        budget_note, outcome, decline_reason, summary, transcript, duration_sec, cost_inr)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     on conflict (call_id) do update set
       transcript = coalesce(excluded.transcript, calls.transcript),
       duration_sec = coalesce(excluded.duration_sec, calls.duration_sec),
       cost_inr = coalesce(excluded.cost_inr, calls.cost_inr),
       summary = coalesce(excluded.summary, calls.summary)
     returning id, outcome`,
    [
      data.call_id, data.caller_name || null, data.caller_phone || null, data.project_type || null, data.area || null,
      data.size_sqft ? Number(data.size_sqft) : null, data.timeline_text || null, data.decision_maker || null,
      data.source || null, data.budget_note || null, data.outcome, data.decline_reason || null, data.summary || null,
      data.transcript || null, data.duration_sec ?? null, data.cost_inr ?? null,
    ],
  );
  return rows[0];
}

export async function setStatus(db, callRowId, status, note = null) {
  await db.query('update calls set status = $1 where id = $2', [status, callRowId]);
  await db.query('insert into status_events (call_id, status, note) values ($1,$2,$3)', [callRowId, status, note]);
}

// What the bot could not finish alone: escalations to call back, missed calls, and declines a person should check.
// Shared by every designer; nobody owns these calls, so anyone can pick one up.
export async function attentionQueue(db) {
  const declines = await db.query(
    `select id, call_id, created_at, caller_name, caller_phone, area, decline_reason, summary
       from calls where outcome = 'declined' and not reviewed order by created_at desc limit 100`,
  );
  const escalations = await db.query(
    `select id, call_id, created_at, caller_name, caller_phone, summary
       from calls where outcome = 'escalated' and status = 'new' order by created_at`,
  );
  const callbacks = await db.query(
    `select id, call_id, created_at, caller_phone
       from calls where outcome = 'missed' and status = 'new' order by created_at`,
  );
  return { declines, escalations, callbacks };
}
