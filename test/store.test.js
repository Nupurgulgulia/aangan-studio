import test from 'node:test';
import assert from 'node:assert/strict';
import { testDb, NOW } from './helpers.js';
import { bookLead, logCall, attentionQueue, setStatus } from '../lib/store.js';

const lead = (n, extra = {}) => ({
  call_id: `call-${n}`, caller_name: `Caller ${n}`, caller_phone: '+910000000000', project_type: '2BHK full home',
  area: 'Baner', size_sqft: 900, timeline_text: 'move in by March', decision_maker: 'owner, spouse agrees',
  start_within_weeks: 20, summary: 'test', ...extra,
});

test('14 qualified leads go to 14 different designers, in order', async () => {
  const db = await testDb();
  const seen = [];
  for (let i = 0; i < 14; i++) seen.push((await bookLead(db, lead(i), NOW)).designer_name);
  assert.equal(new Set(seen).size, 14);
  assert.deepEqual(seen.slice(0, 3), ['Aryan', 'Meera', 'Reyansh']);
  const fifteenth = await bookLead(db, lead(14), NOW);
  assert.equal(fifteenth.designer_name, 'Aryan');
  assert.notEqual(fifteenth.slot.getTime(), (await bookLead(db, lead(0), NOW)).slot.getTime());
});

test('retrying the same call does not book twice', async () => {
  const db = await testDb();
  const a = await bookLead(db, lead(1), NOW);
  const b = await bookLead(db, lead(1), NOW);
  assert.equal(b.repeated, true);
  assert.equal(a.designer_name, b.designer_name);
  const n = await db.query('select count(*)::int as n from bookings');
  assert.equal(n[0].n, 1);
});

test('no two bookings share a designer and slot', async () => {
  const db = await testDb();
  for (let i = 0; i < 40; i++) await bookLead(db, lead(i), NOW);
  const dup = await db.query('select designer_id, start_at, count(*) from bookings group by 1,2 having count(*) > 1');
  assert.equal(dup.length, 0);
});

test('hot lead gets a slot inside two working hours', async () => {
  const db = await testDb();
  const r = await bookLead(db, lead(1, { project_type: 'villa', size_sqft: 5500 }), NOW);
  assert.equal(r.tier, 'hot');
  assert.ok(r.slot <= r.call_by);
  assert.equal(r.window_missed, false);
});

test('budget not stated is recorded as such', async () => {
  const db = await testDb();
  await bookLead(db, lead(1), NOW);
  const rows = await db.query('select budget_note from calls');
  assert.equal(rows[0].budget_note, 'not stated');
});

test('declines land in the needs-attention queue and can be reviewed', async () => {
  const db = await testDb();
  await logCall(db, { call_id: 'd1', outcome: 'declined', decline_reason: 'outside service area: Nashik', caller_phone: '+91', area: 'Nashik' });
  await logCall(db, { call_id: 'e1', outcome: 'escalated', summary: 'existing client, no reply for 5 days' });
  await logCall(db, { call_id: 'm1', outcome: 'missed', caller_phone: '+91' });
  const q = await attentionQueue(db);
  assert.equal(q.declines.length, 1);
  assert.equal(q.escalations.length, 1);
  assert.equal(q.callbacks.length, 1);
  await db.query('update calls set reviewed = true where call_id = $1', ['d1']);
  assert.equal((await attentionQueue(db)).declines.length, 0);
});

test('status updates are recorded', async () => {
  const db = await testDb();
  const r = await bookLead(db, lead(1), NOW);
  await setStatus(db, r.call_row_id, 'held');
  const rows = await db.query('select status from calls where id = $1', [r.call_row_id]);
  assert.equal(rows[0].status, 'held');
});

test('a long booking, like a two hour site visit, blocks every slot it covers', async () => {
  const db = await testDb();
  const first = await bookLead(db, lead(0), NOW);         // Aryan, next free slot
  const start = first.slot;
  await db.query('delete from bookings');
  await db.query("insert into bookings (designer_id, start_at, end_at, kind, title) values (1, $1, $2, 'site_visit', 'Site visit')", [
    start.toISOString(), new Date(start.getTime() + 2 * 3600e3).toISOString(),
  ]);
  await db.query('update rr_state set next_index = 0');
  const second = await bookLead(db, lead(1), NOW);
  assert.equal(second.designer_name, 'Aryan');
  assert.ok(second.slot.getTime() >= start.getTime() + 2 * 3600e3, 'lands after the visit ends');
});
