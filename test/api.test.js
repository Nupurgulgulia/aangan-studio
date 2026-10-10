import test from 'node:test';
import assert from 'node:assert/strict';
import { testDb, fakeRes, signedIn, request } from './helpers.js';
import { formatHandoff } from '../lib/notify.js';
import { createDeal, STAGE_FOR_STATUS } from '../lib/hubspot.js';

process.env.AGENT_API_KEY = 'test-key';
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.HUBSPOT_TOKEN;

const call = async (mod, body, headers = { 'x-api-key': 'test-key' }, method = 'POST') => {
  const handler = (await import(`../handlers/${mod}.js`)).default;
  const res = fakeRes();
  await handler({ method, headers, body, query: {} }, res);
  return res;
};

test('requests without the shared key are refused', async () => {
  await testDb();
  assert.equal((await call('check-area', { area: 'Baner' }, {})).statusCode, 401);
});

test('check-area tool', async () => {
  await testDb();
  assert.equal((await call('check-area', { area: 'Nashik' })).body.status, 'out');
});

test('book tool returns a sentence the agent can say, and works without Telegram or HubSpot keys', async () => {
  await testDb();
  const res = await call('book', {
    call_id: 'x1', caller_name: 'Priya', caller_phone: '+91', project_type: '3BHK full home', area: 'Kothrud', size_sqft: 1400,
    timeline_text: 'by March', decision_maker: 'owner', referral: true, start_within_weeks: 26, source: 'referral',
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.booked, true);
  assert.equal(res.body.tier, 'priority');
  assert.match(res.body.spoken, /^Aryan will call you /);
  assert.equal(res.body.notifications.telegram.skipped, true);
  assert.equal(res.body.notifications.hubspot.skipped, true);
});

test('log-call tool validates the outcome', async () => {
  await testDb();
  assert.equal((await call('log-call', { call_id: 'y', outcome: 'nope' })).body.error.includes('outcome must be'), true);
  assert.equal((await call('log-call', { call_id: 'y', outcome: 'declined', decline_reason: 'restaurant' })).body.logged, true);
});

test('handoff message carries tier, deadline, booked time and the fields the designer needs', () => {
  const text = formatHandoff(
    { caller_name: 'Priya', area: 'Kothrud', project_type: '3BHK full home', size_sqft: 1400, timeline_text: 'by March', decision_maker: 'owner', source: 'referral', caller_phone: '+91' },
    { tier: 'priority', designer_name: 'Meera', tier_reasons: ['referral'], call_by: new Date(Date.UTC(2026, 9, 8, 5, 30)), slot: new Date(Date.UTC(2026, 9, 8, 6, 0)), window_missed: false },
  );
  assert.match(text, /^Chayya, front desk\. New PRIORITY lead for Meera:\nreferral/);
  assert.match(text, /Call by Thu 8 Oct, 11:00 AM/);
  assert.match(text, /Booked Thu 8 Oct, 11:30 AM/);
  assert.match(text, /Budget: not stated/);
});

test('HubSpot deal is created with 8 custom properties, all in the free plan limit', async () => {
  process.env.HUBSPOT_TOKEN = 'x';
  const sent = [];
  const fakeFetch = async (url, init) => {
    sent.push({ url, init });
    const id = url.includes('contacts') && !url.includes('associations') ? 'c1' : 'd1';
    return { ok: true, text: async () => JSON.stringify({ id }) };
  };
  const r = await createDeal({ call_id: 'z', caller_name: 'Priya Rao', area: 'Baner', size_sqft: 900, source: 'instagram' }, { tier: 'hot', call_by: new Date(), designer_name: 'Meera' }, fakeFetch);
  delete process.env.HUBSPOT_TOKEN;
  assert.equal(r.deal_id, 'd1');
  const dealBody = JSON.parse(sent.find((s) => s.url.endsWith('/deals')).init.body);
  assert.equal(Object.keys(dealBody.properties).filter((k) => k.startsWith('aangan_')).length, 8);
  assert.equal(STAGE_FOR_STATUS.won, 'closedwon');
});

test('book without a call id derives one, and a retry for the same number does not book twice', async () => {
  await testDb();
  const body = { caller_name: 'Retry', caller_phone: '+91 98765 43210', project_type: '2BHK', area: 'Baner' };
  const a = await call('book', body);
  const b = await call('book', body);
  assert.equal(a.body.booked, true);
  assert.equal(b.body.repeated, true);
  assert.equal(b.body.spoken, a.body.spoken);
});

test('a designer sees only their own leads and can mark a status from the dashboard', async () => {
  const db = await testDb();
  await call('book', { call_id: 'm1', caller_name: 'One', caller_phone: '+91 90000 22221', project_type: '2BHK', area: 'Baner' });
  await call('book', { call_id: 'm2', caller_name: 'Two', caller_phone: '+91 90000 22222', project_type: '2BHK', area: 'Aundh' });
  const aryan = await signedIn(db, 'aryan');
  const mine = await request('my-leads', { method: 'GET', headers: aryan });
  assert.equal(mine.body.leads.length, 1);
  assert.equal(mine.body.leads[0].caller_name, 'One');
  const set = await request('set-status', { headers: aryan, body: { id: mine.body.leads[0].id, status: 'called' } });
  assert.equal(set.body.ok, true);
  assert.equal((await request('my-leads', { method: 'GET', headers: aryan })).body.leads[0].status, 'called');
  assert.equal((await request('set-status', { headers: aryan, body: { id: mine.body.leads[0].id, status: 'bogus' } })).body.error, 'unknown status');
});

test('after a booking, Chayya saves the message to the designer and a confirmation ready to send to the caller', async () => {
  const db = await testDb();
  const res = await call('book', { call_id: 'ch1', caller_name: 'Priya Rao', caller_phone: '+91 90000 33333', project_type: '3BHK full home', area: 'Baner', size_sqft: 1300 });
  assert.equal(res.body.notifications.caller_message.sent, false);
  const rows = await db.query('select channel, sender, to_name, status, body from messages order by id');
  assert.deepEqual(rows.map((r) => [r.channel, r.sender, r.to_name]), [['telegram', 'Chayya', 'Aryan'], ['whatsapp', 'Chayya', 'Priya Rao']]);
  assert.match(rows[1].body, /^Namaste Priya, this is Chayya from Aangan Studio\./);
  assert.match(rows[1].body, /Your designer Aryan will call you on /);
  assert.equal(rows[1].status, 'not_sent');
});
