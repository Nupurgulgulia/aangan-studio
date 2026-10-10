import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';

// Remove a photo or design the designer uploaded by mistake. Only their own projects.
export default route({ auth: 'user', roles: ['designer'] }, async (req, res) => {
  const db = getDb();
  const { type, id } = req.body || {};
  const table = type === 'photo' ? 'project_photos' : type === 'design' ? 'project_designs' : null;
  if (!table || !Number.isInteger(id)) return res.status(400).json({ error: 'type must be photo or design, and id a number' });
  const row = (await db.query(`select t.id, t.image_path from ${table} t join projects p on p.id = t.project_id where t.id = $1 and p.designer_id = $2`, [id, req.user.designer_id]))[0];
  if (!row) return res.status(404).json({ error: 'not found' });
  await db.query(`delete from ${table} where id = $1`, [id]);
  const m = /^\/api\/file\?id=(\d+)$/.exec(row.image_path || '');
  if (m) await db.query('delete from files where id = $1', [Number(m[1])]);
  return { ok: true };
});
