import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { inspectUpload } from '../lib/files.js';

const STAGES = ['site_check', 'civil', 'electrical', 'ceiling', 'tiling', 'carpentry', 'painting', 'finishing', 'handover', 'other'];

// A designer adds a site photo to one of their projects (from the phone camera or the gallery).
export default route({ auth: 'user', roles: ['designer'] }, async (req, res) => {
  const db = getDb();
  const { project_id: projectId, caption, stage, taken_on: takenOn, data, mime, name } = req.body || {};
  const project = (await db.query('select id from projects where id = $1 and designer_id = $2', [Number(projectId), req.user.designer_id]))[0];
  if (!project) return res.status(404).json({ error: 'not found' });
  const file = inspectUpload(data, mime);
  if (file.error) return res.status(400).json({ error: file.error });
  const cleanStage = STAGES.includes(stage) ? stage : 'other';
  const text = String(caption || '').trim().slice(0, 200) || 'Site photo';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(takenOn || '')) ? takenOn : new Date().toISOString().slice(0, 10);
  const saved = (await db.query(
    `insert into files (project_id, kind, mime, size, name, data, uploaded_by) values ($1,'photo',$2,$3,$4,decode($5,'base64'),$6) returning id`,
    [project.id, file.mime, file.buf.length, String(name || '').slice(0, 120) || null, file.buf.toString('base64'), req.user.id],
  ))[0];
  const row = (await db.query(
    'insert into project_photos (project_id, caption, stage, taken_on, image_path) values ($1,$2,$3,$4,$5) returning id, caption, stage, taken_on, image_path',
    [project.id, text, cleanStage, day, `/api/file?id=${saved.id}`],
  ))[0];
  await db.query('update projects set hero_photo = $1 where id = $2', [row.image_path, project.id]);
  return { photo: row };
});
