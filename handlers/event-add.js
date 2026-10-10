import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { DEFAULT_HOURS, fromIST, toIST } from '../lib/time.js';

const KINDS = { site_visit: 'Site visit', design_review: 'Design review', client_meeting: 'Client meeting', vendor: 'Showroom visit', measurement: 'Measurement', handover: 'Handover' };

// A designer puts a visit or meeting on their own calendar for one of their projects. It cannot overlap anything already there,
// so Chayya never books a new enquiry on top of it.
export default route({ auth: 'user', roles: ['designer'] }, async (req, res) => {
  const db = getDb();
  const { project_id: projectId, kind, date, start, duration_min: duration, location } = req.body || {};
  const project = (await db.query('select id, name from projects where id = $1 and designer_id = $2', [Number(projectId), req.user.designer_id]))[0];
  if (!project) return res.status(404).json({ error: 'not found' });
  if (!KINDS[kind]) return res.status(400).json({ error: 'Choose what kind of visit or meeting it is.' });
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || '')), t = /^(\d{1,2}):(\d{2})$/.exec(String(start || ''));
  if (!d || !t) return res.status(400).json({ error: 'Choose a date and a start time.' });
  const minutes = Number(t[1]) * 60 + Number(t[2]), length = Number(duration);
  if (!(length >= 30 && length <= 240 && length % 30 === 0) || minutes % 30 !== 0) return res.status(400).json({ error: 'Use a start time on the hour or half hour, and a length from 30 minutes to 4 hours.' });
  const begin = fromIST(Number(d[1]), Number(d[2]) - 1, Number(d[3]), minutes);
  const end = new Date(begin.getTime() + length * 60000);
  const hours = DEFAULT_HOURS[toIST(begin).weekday];
  if (!hours || minutes < hours[0] || minutes + length > hours[1]) return res.status(400).json({ error: 'That is outside studio hours (Monday to Saturday, 10 am to 7 pm).' });
  const clash = (await db.query(
    'select title, start_at from bookings where designer_id = $1 and start_at < $3 and end_at > $2 order by start_at limit 1',
    [req.user.designer_id, begin.toISOString(), end.toISOString()],
  ))[0];
  if (clash) return res.status(409).json({ error: `That overlaps "${clash.title || 'a booking'}" on your calendar.` });
  const surname = project.name.split(/\s+/)[0];
  const row = (await db.query(
    `insert into bookings (designer_id, start_at, end_at, kind, title, project_id, location) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [req.user.designer_id, begin.toISOString(), end.toISOString(), kind, `${KINDS[kind]} · ${surname}`, project.id, String(location || '').trim().slice(0, 160) || null],
  ))[0];
  return { ok: true, id: row.id };
});
