import test from 'node:test';
import assert from 'node:assert/strict';
import { testDb, addUser, signedIn, request, PASSWORD } from './helpers.js';
import { hashPassword, verifyPassword, passwordProblem } from '../lib/auth.js';
import { ensureUsers } from '../lib/users.js';
import { notifyEscalation } from '../lib/handoff.js';

process.env.AGENT_API_KEY = 'test-key';
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.HUBSPOT_TOKEN;

const AGENT = { 'x-api-key': 'test-key' };
const JSON_HEADERS = { 'content-type': 'application/json' };
const login = (username, password, host = 'localhost:3000') =>
  request('login', { headers: { ...JSON_HEADERS, host }, body: { username, password } });
const book = (id, name, area = 'Baner') =>
  request('book', { headers: AGENT, body: { call_id: id, caller_name: name, caller_phone: `+91 9000${id}`, project_type: '2BHK', area } });

test('password hashes verify, and the wrong password or a different hash does not', async () => {
  const h = await hashPassword('Right-pass-1');
  assert.equal(await verifyPassword('Right-pass-1', h), true);
  assert.equal(await verifyPassword('Wrong-pass-1', h), false);
  assert.equal(await verifyPassword('Right-pass-1', await hashPassword('Right-pass-1')) , true);
  assert.notEqual(h, await hashPassword('Right-pass-1'));
});

test('password rules', () => {
  assert.match(passwordProblem('short1'), /10 characters/);
  assert.match(passwordProblem('onlyletterspassword'), /letter and one number/);
  assert.match(passwordProblem('aryan-pass-123', 'aryan'), /username/);
  assert.equal(passwordProblem('good-pass-123', 'aryan'), null);
});

test('login sets an HttpOnly session cookie and the pages can then ask who is signed in', async () => {
  const db = await testDb();
  await addUser(db, 'meera');
  const ok = await login('Meera', PASSWORD);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.user.role, 'designer');
  assert.equal(ok.body.user.password_hash, undefined);
  const cookie = ok.headers['set-cookie'];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(cookie, /Secure/, 'plain http on localhost');
  assert.match((await login('meera', PASSWORD, 'aangan-gold.vercel.app')).headers['set-cookie'], /Secure/);
  const me = await request('me', { method: 'GET', headers: { cookie: cookie.split(';')[0] } });
  assert.equal(me.body.user.username, 'meera');
});

test('wrong password and unknown user get the same answer; no cookie is set', async () => {
  const db = await testDb();
  await addUser(db, 'meera');
  const a = await login('meera', 'nope-nope-1');
  const b = await login('nobody', 'nope-nope-1');
  assert.equal(a.statusCode, 401);
  assert.deepEqual(a.body, b.body);
  assert.equal(a.headers['set-cookie'], undefined);
});

test('five wrong passwords lock the account, even for the right password, and a switched-off login cannot sign in', async () => {
  const db = await testDb();
  await addUser(db, 'meera');
  await addUser(db, 'kabir');
  for (let i = 0; i < 5; i++) await login('meera', 'nope-nope-1');
  const locked = await login('meera', PASSWORD);
  assert.equal(locked.statusCode, 429);
  assert.match(locked.body.error, /Try again in/);
  await db.query("update users set locked_until = now() - interval '1 minute' where username = 'meera'");
  assert.equal((await login('meera', PASSWORD)).statusCode, 200);
  await db.query("update users set active = false where username = 'kabir'");
  assert.equal((await login('kabir', PASSWORD)).statusCode, 401);
});

test('dashboard endpoints need a login; a forged form post without a JSON content type is refused', async () => {
  const db = await testDb();
  assert.equal((await request('queue', { method: 'GET' })).statusCode, 401);
  assert.equal((await request('my-leads', { method: 'GET', headers: AGENT })).statusCode, 401, 'the agent key is not a person');
  const aryan = await signedIn(db, 'aryan');
  assert.equal((await request('queue', { method: 'GET', headers: aryan })).statusCode, 200);
  assert.equal((await request('review', { headers: { cookie: aryan.cookie }, body: { id: 1, action: 'reviewed' } })).statusCode, 415);
});

test('a designer sees only their own leads, and cannot open or change another designer\'s lead', async () => {
  const db = await testDb();
  await book('1', 'First');   // Aryan
  await book('2', 'Second');  // Meera
  const aryan = await signedIn(db, 'aryan');
  const mine = await request('my-leads', { method: 'GET', headers: aryan });
  assert.equal(mine.body.leads.length, 1);
  assert.equal(mine.body.leads[0].caller_name, 'First');
  const meeraCall = (await db.query("select id from calls where caller_name = 'Second'"))[0].id;
  assert.equal((await request('call', { method: 'GET', headers: aryan, query: { id: meeraCall } })).statusCode, 404);
  assert.equal((await request('set-status', { headers: aryan, body: { id: meeraCall, status: 'won' } })).statusCode, 404);
  const own = mine.body.leads[0].id;
  assert.equal((await request('call', { method: 'GET', headers: aryan, query: { id: own } })).body.call.caller_name, 'First');
});

test('every designer sees the calls the bot could not finish, and can open them', async () => {
  const db = await testDb();
  await request('log-call', { headers: AGENT, body: { call_id: 'n1', outcome: 'declined', decline_reason: 'restaurant', caller_name: 'Cafe Owner' } });
  await request('log-call', { headers: AGENT, body: { call_id: 'n2', outcome: 'escalated', caller_name: 'Upset Client', caller_phone: '+91 90000 00002', summary: 'Wants Nikhil' } });
  await request('log-call', { headers: AGENT, body: { call_id: 'n3', outcome: 'missed', caller_phone: '+91 90000 00003' } });
  const q = await request('queue', { method: 'GET', headers: await signedIn(db, 'riya') });
  assert.equal(q.body.declines.length, 1);
  assert.equal(q.body.escalations.length, 1);
  assert.equal(q.body.callbacks.length, 1);
  assert.equal(q.body.lateBookings, undefined, 'other designers\' bookings are not shared');
  const open = await request('call', { method: 'GET', headers: await signedIn(db, 'kabir'), query: { id: q.body.declines[0].id } });
  assert.equal(open.body.call.caller_name, 'Cafe Owner');
});

test('Chayya\'s test login sees every call and the console, and nothing a designer edits', async () => {
  const db = await testDb();
  await request('log-call', { headers: AGENT, body: { call_id: 'c1', outcome: 'declined', decline_reason: 'restaurant', caller_name: 'Cafe Owner' } });
  const chayya = await signedIn(db, 'chayya', 'chayya');
  const con = await request('chayya', { method: 'GET', headers: chayya });
  assert.equal(con.statusCode, 200);
  assert.equal(con.body.calls.length, 1);
  assert.equal(con.body.counts.declined, 1);
  assert.ok(con.body.next_designer);
  assert.equal((await request('call', { method: 'GET', headers: chayya, query: { id: con.body.calls[0].id } })).body.call.caller_name, 'Cafe Owner');
  for (const name of ['my-leads', 'queue', 'calendar', 'projects']) assert.equal((await request(name, { method: 'GET', headers: chayya })).statusCode, 403, name);
  assert.equal((await request('review', { headers: chayya, body: { id: 1, action: 'done' } })).statusCode, 403);
  assert.equal((await request('chayya', { method: 'GET', headers: await signedIn(db, 'riya') })).statusCode, 403, 'designers cannot open the console');
});

test('the calendar shows a designer only their own bookings in detail', async () => {
  const db = await testDb();
  await book('1', 'First');
  await book('2', 'Second');
  const aryan = await signedIn(db, 'aryan');
  const cal = await request('calendar', { method: 'GET', headers: aryan });
  const own = cal.body.bookings.filter((b) => !b.busy);
  const others = cal.body.bookings.filter((b) => b.busy);
  assert.equal(own.length, 1);
  assert.equal(own[0].caller_name, 'First');
  assert.equal(others.length, 1);
  assert.equal(others[0].caller_name, undefined);
  assert.equal(cal.body.designers.length, 14);
  assert.equal(cal.body.next_designer, null, 'the rotation is not shown to designers');
});

test('first login forces a new password; afterwards the old one stops working', async () => {
  const db = await testDb();
  await addUser(db, 'ananya', 'designer', { mustChange: true });
  const first = await login('ananya', PASSWORD);
  const cookie = { cookie: first.headers['set-cookie'].split(';')[0], ...JSON_HEADERS };
  assert.equal(first.body.user.must_change, true);
  assert.equal((await request('my-leads', { method: 'GET', headers: cookie })).body.error, 'password_change_required');
  assert.equal((await request('change-password', { headers: cookie, body: { current: 'wrong-pass-1', next: 'Brand-new-pass-9' } })).statusCode, 400);
  assert.match((await request('change-password', { headers: cookie, body: { current: PASSWORD, next: 'short1' } })).body.error, /10 characters/);
  const changed = await request('change-password', { headers: cookie, body: { current: PASSWORD, next: 'Brand-new-pass-9' } });
  assert.equal(changed.statusCode, 200);
  assert.equal(changed.body.user.must_change, false);
  assert.equal((await request('my-leads', { method: 'GET', headers: cookie })).statusCode, 401, 'old session ended');
  const fresh = { cookie: changed.headers['set-cookie'].split(';')[0], ...JSON_HEADERS };
  assert.equal((await request('my-leads', { method: 'GET', headers: fresh })).statusCode, 200);
  assert.equal((await login('ananya', PASSWORD)).statusCode, 401);
  assert.equal((await login('ananya', 'Brand-new-pass-9')).statusCode, 200);
});

test('logout ends the session', async () => {
  const db = await testDb();
  const h = await signedIn(db, 'aryan');
  assert.equal((await request('me', { method: 'GET', headers: h })).statusCode, 200);
  const out = await request('logout', { headers: h });
  assert.match(out.headers['set-cookie'], /Max-Age=0/);
  assert.equal((await request('me', { method: 'GET', headers: h })).statusCode, 401);
});

test('an expired session is refused', async () => {
  const db = await testDb();
  const h = await signedIn(db, 'aryan');
  await db.query("update sessions set expires_at = now() - interval '1 hour'");
  assert.equal((await request('me', { method: 'GET', headers: h })).statusCode, 401);
});

test('ensureUsers makes a login for every designer, once, with one-time passwords that must be changed', async () => {
  const db = await testDb();
  const created = await ensureUsers(db);
  assert.equal(created.length, 15);
  assert.equal(created.filter((u) => u.role === 'designer').length, 14);
  assert.equal(created.filter((u) => u.role === 'chayya').length, 1);
  assert.equal(new Set(created.map((u) => u.password)).size, 15);
  assert.equal((await ensureUsers(db)).length, 0);
  const row = (await db.query("select must_change, password_hash from users where username = 'aryan'"))[0];
  assert.equal(row.must_change, true);
  assert.doesNotMatch(row.password_hash, new RegExp(created.find((u) => u.username === 'aryan').password));
  const pw = created.find((u) => u.username === 'meera').password;
  assert.equal((await login('meera', pw)).statusCode, 200);
});

test('a designer can reverse a wrong decline: the same call is booked as hot to the next designer in rotation', async () => {
  const db = await testDb();
  await request('log-call', { headers: AGENT, body: { call_id: 'w1', outcome: 'declined', decline_reason: 'timeline', caller_name: 'Wrongly Declined', caller_phone: '+91 90000 00001', area: 'Baner', project_type: '2BHK' } });
  const desk = await signedIn(db, 'meera');
  const id = (await db.query("select id from calls where call_id = 'w1'"))[0].id;
  const r = await request('review', { headers: desk, body: { id, action: 'reverse', note: 'caller was flexible on the date' } });
  assert.equal(r.body.ok, true);
  assert.equal(r.body.designer, 'Aryan');
  const row = (await db.query('select outcome, tier, reviewed, designer_id, summary from calls where id = $1', [id]))[0];
  assert.equal(row.outcome, 'qualified');
  assert.equal(row.tier, 'hot');
  assert.equal(row.reviewed, true);
  assert.match(row.summary, /reversed by Meera/);
  assert.equal((await db.query('select count(*)::int as n from calls'))[0].n, 1);
  assert.equal((await request('review', { headers: desk, body: { id, action: 'reverse' } })).statusCode, 400, 'only declined calls');
  const detail = await request('call', { method: 'GET', headers: await signedIn(db, 'aryan'), query: { id } });
  assert.equal(detail.body.events.some((e) => e.status === 'reversed'), true, 'the designer who receives it can see why');
});

test('the agent can attach a transcript and recording to a logged call, and people can then read them', async () => {
  const db = await testDb();
  await book('9', 'Talker');
  const row = (await db.query("select call_id from calls where caller_name = 'Talker'"))[0];
  const bad = await request('call-update', { headers: AGENT, body: { call_id: row.call_id, recording_url: 'javascript:alert(1)' } });
  assert.equal(bad.statusCode, 400);
  const ok = await request('call-update', { headers: AGENT, body: { call_id: row.call_id, transcript: 'Agent: Hello\nCaller: Hi', recording_url: 'https://example.com/r.mp3', duration_sec: 95 } });
  assert.equal(ok.body.updated, 1);
  const detail = await request('call', { method: 'GET', headers: await signedIn(db, 'aryan'), query: { id: (await db.query("select id from calls where caller_name = 'Talker'"))[0].id } });
  assert.equal(detail.body.call.transcript, 'Agent: Hello\nCaller: Hi');
  assert.equal(detail.body.call.recording_url, 'https://example.com/r.mp3');
  assert.equal((await request('call-update', { headers: {}, body: { call_id: row.call_id } })).statusCode, 401);
});

test('an escalation sends one Telegram alert, even if the agent retries the log', async () => {
  const db = await testDb();
  await db.query("update designers set telegram_chat_id = '555' where name = 'Aryan'");
  await request('log-call', { headers: AGENT, body: { call_id: 'e1', outcome: 'escalated', caller_name: 'Upset Client', caller_phone: '+91 90000 00002', summary: 'Wants Nikhil' } });
  const id = (await db.query("select id from calls where call_id = 'e1'"))[0].id;
  process.env.TELEGRAM_BOT_TOKEN = 'x';
  const sent = [];
  const fakeFetch = async (url, init) => { sent.push(JSON.parse(init.body)); return { json: async () => ({ ok: true, result: { message_id: 7 } }) }; };
  const first = await notifyEscalation({ id, caller_name: 'Upset Client', caller_phone: '+91 90000 00002', summary: 'Wants Nikhil' }, fakeFetch);
  const again = await notifyEscalation({ id, caller_name: 'Upset Client' }, fakeFetch);
  delete process.env.TELEGRAM_BOT_TOKEN;
  assert.equal(first.sent, true);
  assert.equal(again.skipped, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chat_id, '555');
  assert.match(sent[0].text, /^ESCALATION: call back within 15 minutes\nUpset Client, \+91 90000 00002\nWants Nikhil/);
  assert.equal(sent[0].reply_markup, undefined, 'no status buttons on an alert');
});

test('without a Telegram token the escalation is still logged and the alert is skipped', async () => {
  await testDb();
  const r = await request('log-call', { headers: AGENT, body: { call_id: 'e2', outcome: 'escalated', caller_name: 'X' } });
  assert.equal(r.body.logged, true);
  assert.equal(r.body.alert.skipped, true);
});
