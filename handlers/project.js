import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';

// One project in full: the customer, designs, site photos, upcoming and recent visits, and what Chayya has sent.
// A designer can open only their own projects.
export default route({ method: 'GET', auth: 'user', roles: ['designer'] }, async (req, res) => {
  const db = getDb();
  const id = Number(req.query?.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id must be a number' });
  const project = (await db.query(
    `select p.id, p.code, p.call_id, p.name, p.customer_name, p.customer_phone, p.area, p.site_address, p.project_type, p.size_sqft, p.stage, p.progress_pct,
            p.start_date, p.target_date, p.value_lakh, p.summary, p.hero_photo
       from projects p where p.id = $1 and p.designer_id = $2`,
    [id, req.user.designer_id],
  ))[0];
  if (!project) return res.status(404).json({ error: 'not found' });
  const designs = await db.query(
    `select d.id, d.title, d.kind, d.version, d.status, d.image_path, d.shared_on,
            (select f.mime from files f where d.image_path = '/api/file?id=' || f.id) as mime
       from project_designs d where d.project_id = $1 order by d.shared_on desc, d.version desc, d.id`,
    [id],
  );
  const photos = await db.query('select id, caption, stage, taken_on, image_path from project_photos where project_id = $1 order by taken_on desc, id desc', [id]);
  const events = await db.query(
    `select kind, title, start_at, end_at, location from bookings where project_id = $1 and start_at > now() - interval '14 days' order by start_at`,
    [id],
  );
  const messages = await db.query(
    `select id, channel, sender, to_name, to_address, body, status, note, created_at from messages
      where project_id = $1 or (call_id is not null and call_id = $2) order by created_at desc`,
    [id, project.call_id],
  );
  return { project, designs, photos, events, messages };
});
