import test from 'node:test';
import assert from 'node:assert/strict';
import { testDb } from './helpers.js';
import { seedDemo, removeDemo } from '../lib/demo/seed.js';

process.env.AGENT_API_KEY = 'test-key';
const NOW = new Date(Date.UTC(2026, 9, 10, 13, 0)); // Saturday 6:30 PM India time

test('demo data: every designer has ongoing projects, a busy calendar, transcripts, designs, photos and Chayya messages', async () => {
  const db = await testDb();
  const r = await seedDemo(db, { now: NOW });
  assert.equal(r.projects, 44);
  const perDesigner = await db.query('select d.name, count(p.id)::int n from designers d left join projects p on p.designer_id = d.id group by d.name');
  assert.equal(perDesigner.every((x) => x.n >= 3), true);
  assert.equal(perDesigner.find((x) => x.name === 'Aryan').n, 5);
  const stages = await db.query('select distinct stage from projects');
  assert.equal(stages.length, 5);

  // calendars: nothing overlaps for a designer, everything is inside studio hours, and each designer has events
  const bookings = await db.query('select designer_id, start_at, end_at from bookings order by designer_id, start_at');
  const byDesigner = new Map();
  for (const b of bookings) {
    const list = byDesigner.get(b.designer_id) || [];
    const s = new Date(b.start_at).getTime(), e = new Date(b.end_at).getTime();
    if (list.length) assert.ok(s >= list[list.length - 1], 'no overlapping events');
    const ist = new Date(s + 330 * 60000), iend = new Date(e + 330 * 60000);
    assert.notEqual(ist.getUTCDay(), 0, 'no Sunday events');
    assert.ok(ist.getUTCHours() * 60 + ist.getUTCMinutes() >= 600, 'starts after 10:00');
    assert.ok(iend.getUTCHours() * 60 + iend.getUTCMinutes() <= 1140, 'ends by 19:00');
    list.push(e);
    byDesigner.set(b.designer_id, list);
  }
  assert.equal(byDesigner.size, 14);
  assert.ok([...byDesigner.values()].every((l) => l.length >= 4));

  // every project has its source call with a transcript, designs and photos; most have messages from Chayya
  const noTranscript = await db.query("select count(*)::int n from calls where is_demo and outcome <> 'missed' and transcript is null");
  assert.equal(noTranscript[0].n, 0);
  assert.equal((await db.query('select count(*)::int n from projects p where not exists (select 1 from project_designs d where d.project_id = p.id)'))[0].n, 0);
  assert.equal((await db.query('select count(*)::int n from projects p where not exists (select 1 from project_photos d where d.project_id = p.id)'))[0].n, 0);
  assert.equal((await db.query("select count(*)::int n from messages where sender <> 'Chayya'"))[0].n, 0);
  assert.ok((await db.query("select count(*)::int n from messages where channel = 'telegram'"))[0].n > 40);

  // Aryan's first working morning stays free for the live walk-through
  const monday = new Date(Date.UTC(2026, 9, 12, 4, 30)); // Monday 10:00 India time
  const clash = await db.query('select count(*)::int n from bookings where designer_id = 1 and start_at < $1 and end_at > $2', [new Date(monday.getTime() + 60 * 60000).toISOString(), monday.toISOString()]);
  assert.equal(clash[0].n, 0);

  // the next qualified call goes to Aryan, and re-running replaces the demo rows instead of doubling them
  assert.equal((await db.query('select next_index from rr_state'))[0].next_index, 0);
  const again = await seedDemo(db, { now: NOW });
  assert.equal(again.removed, r.calls);
  assert.equal((await db.query('select count(*)::int n from projects'))[0].n, 44);
});

test('removing the demo data leaves real rows alone', async () => {
  const db = await testDb();
  await db.query("insert into calls (call_id, outcome, caller_name) values ('real-1', 'declined', 'Real Caller')");
  await seedDemo(db, { now: NOW });
  await removeDemo(db);
  assert.equal((await db.query('select count(*)::int n from calls'))[0].n, 1);
  assert.equal((await db.query('select count(*)::int n from projects'))[0].n, 0);
  assert.equal((await db.query('select count(*)::int n from bookings'))[0].n, 0);
  assert.equal((await db.query('select count(*)::int n from messages'))[0].n, 0);
});

test('a designer sees only their own projects, and the project page has designs, photos, schedule and Chayya messages', async () => {
  const { signedIn, request } = await import('./helpers.js');
  const db = await testDb();
  await seedDemo(db, { now: NOW });
  const aryan = await signedIn(db, 'aryan');
  const list = await request('projects', { method: 'GET', headers: aryan });
  assert.equal(list.body.projects.length, 5);
  assert.ok(list.body.projects.every((p) => p.hero_photo && p.designs > 0 && p.photos > 0));
  assert.ok(list.body.projects.some((p) => p.next_event));
  const one = await request('project', { method: 'GET', headers: aryan, query: { id: list.body.projects[0].id } });
  assert.ok(one.body.designs.length >= 3 && one.body.photos.length >= 2 && one.body.messages.length >= 2);
  assert.ok(one.body.messages.every((m) => m.sender === 'Chayya'));
  const others = (await db.query("select id from projects where designer_id = 2 limit 1"))[0].id;
  assert.equal((await request('project', { method: 'GET', headers: aryan, query: { id: others } })).statusCode, 404);
  // the calendar shows Aryan's own events in full and everyone else's as busy
  const cal = await request('calendar', { method: 'GET', headers: aryan });
  const mine = cal.body.bookings.filter((b) => !b.busy);
  assert.ok(mine.length >= 4 && mine.every((b) => b.title));
  assert.ok(cal.body.bookings.filter((b) => b.busy).every((b) => b.title === undefined));
});

// A 1x1 JPEG and a tiny PDF, the smallest valid files of each type
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');

test('a designer can start a project from a won lead, upload photos and designs, move the stage, and schedule a visit', async () => {
  const { signedIn, request } = await import('./helpers.js');
  const db = await testDb();
  const aryan = await signedIn(db, 'aryan');
  const meera = await signedIn(db, 'meera');
  const kabir = await signedIn(db, 'kabir');
  const book = await request('book', { headers: { 'x-api-key': 'test-key' }, body: { call_id: 'u1', caller_name: 'Neha Joshi', caller_phone: '+91 90000 77777', project_type: '3BHK full home', area: 'Aundh', size_sqft: 1300 } });
  assert.equal(book.body.designer, 'Aryan');
  const callId = (await db.query("select id from calls where call_id = 'u1'"))[0].id;
  // not won yet: it is not offered, and a project cannot be created
  assert.equal((await request('projects', { method: 'GET', headers: aryan })).body.won_without_project.length, 0);
  await request('set-status', { headers: aryan, body: { id: callId, status: 'won' } });
  assert.equal((await request('projects', { method: 'GET', headers: aryan })).body.won_without_project.length, 1);
  const made = await request('project-create', { headers: aryan, body: { call_id: callId, name: 'Joshi residence', site_address: 'Flat 504, Palm Court, Aundh', value_lakh: 12.5, target_date: '2027-02-15' } });
  const id = made.body.project_id;
  assert.ok(id);
  assert.equal((await request('project-create', { headers: aryan, body: { call_id: callId } })).statusCode, 409, 'one project per lead');
  const proj = await request('project', { method: 'GET', headers: aryan, query: { id } });
  assert.equal(proj.body.project.customer_name, 'Neha Joshi');
  assert.equal(proj.body.project.stage, 'design');

  // photos and designs: the contents are checked, not just the label
  const photo = await request('project-photo', { headers: aryan, body: { project_id: id, caption: 'Bare flat, measurements taken', stage: 'site_check', data: JPEG.toString('base64'), mime: 'image/jpeg', name: 'IMG_1.jpg' } });
  assert.match(photo.body.photo.image_path, /^\/api\/file\?id=\d+$/);
  assert.equal((await request('project-photo', { headers: aryan, body: { project_id: id, data: Buffer.from('<svg onload=alert(1)>').toString('base64'), mime: 'image/svg+xml' } })).statusCode, 400);
  assert.equal((await request('project-photo', { headers: aryan, body: { project_id: id, data: PDF.toString('base64'), mime: 'application/pdf' } })).statusCode, 400, 'photos must be images');
  assert.equal((await request('project-photo', { headers: aryan, body: { project_id: id, data: JPEG.toString('base64'), mime: 'image/png' } })).statusCode, 400, 'label must match contents');
  assert.equal((await request('project-photo', { headers: aryan, body: { project_id: id, data: Buffer.alloc(3 * 1024 * 1024, 0xff).toString('base64'), mime: 'image/jpeg' } })).statusCode, 400, 'too large');
  const design = await request('project-design', { headers: aryan, body: { project_id: id, title: 'Furnished floor plan', kind: 'layout', status: 'shared', data: PDF.toString('base64'), mime: 'application/pdf' } });
  const again = await request('project-design', { headers: aryan, body: { project_id: id, title: 'Furnished floor plan', kind: 'layout', data: JPEG.toString('base64') } });
  assert.equal(design.body.design.version, 1);
  assert.equal(again.body.design.version, 2, 'the next version of the same drawing');
  assert.equal((await request('project-design', { headers: aryan, body: { project_id: id, title: '', data: JPEG.toString('base64') } })).statusCode, 400);

  // the file comes back to its owner only, as the right type, with safe headers
  const fileId = photo.body.photo.image_path.split('=')[1];
  const got = await request('file', { method: 'GET', headers: aryan, query: { id: fileId } });
  assert.equal(got.file.type, 'image/jpeg');
  assert.deepEqual(got.file.buf, JPEG);
  assert.equal(got.file.headers['x-content-type-options'], 'nosniff');
  assert.equal((await request('file', { method: 'GET', headers: meera, query: { id: fileId } })).statusCode, 404);
  assert.equal((await request('project-photo', { headers: kabir, body: { project_id: id, data: JPEG.toString('base64') } })).statusCode, 404);
  assert.equal((await request('projects', { method: 'GET', headers: aryan })).body.projects[0].hero_photo, photo.body.photo.image_path);

  // stage, progress and notes
  assert.equal((await request('project-update', { headers: aryan, body: { id, stage: 'approvals', progress_pct: 35 } })).body.ok, true);
  assert.equal((await request('project', { method: 'GET', headers: aryan, query: { id } })).body.project.stage, 'approvals');
  assert.equal((await request('project-update', { headers: aryan, body: { id, stage: 'nonsense' } })).statusCode, 400);
  assert.equal((await request('project-update', { headers: aryan, body: { id, progress_pct: 140 } })).statusCode, 400);

  // a visit goes on the calendar, and cannot overlap or fall outside studio hours
  const visit = { project_id: id, kind: 'site_visit', date: '2026-10-14', start: '11:00', duration_min: 120, location: 'Palm Court, Aundh' };
  assert.equal((await request('event-add', { headers: aryan, body: visit })).body.ok, true);
  assert.equal((await request('event-add', { headers: aryan, body: { ...visit, start: '12:00', duration_min: 60 } })).statusCode, 409);
  assert.equal((await request('event-add', { headers: aryan, body: { ...visit, date: '2026-10-18' } })).statusCode, 400, 'Sunday');
  assert.equal((await request('event-add', { headers: aryan, body: { ...visit, start: '18:00', duration_min: 120 } })).statusCode, 400, 'after hours');
  assert.equal((await request('event-add', { headers: aryan, body: { ...visit, kind: 'party' } })).statusCode, 400);
  assert.equal((await request('event-add', { headers: kabir, body: visit })).statusCode, 404);
  const taken = await db.query("select count(*)::int n from bookings where project_id = $1", [id]);
  assert.equal(taken[0].n, 1);

  // delete a mistaken upload: the row and the file go
  assert.equal((await request('item-delete', { headers: aryan, body: { type: 'photo', id: photo.body.photo.id } })).body.ok, true);
  assert.equal((await db.query('select count(*)::int n from files where id = $1', [fileId]))[0].n, 0);
  assert.equal((await request('item-delete', { headers: meera, body: { type: 'design', id: design.body.design.id } })).statusCode, 404);
});
