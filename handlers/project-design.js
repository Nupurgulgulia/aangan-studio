import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { inspectUpload } from '../lib/files.js';

const KINDS = ['layout', 'concept', 'material_board', 'elevation', 'other'];
const STATUSES = ['draft', 'shared', 'approved', 'revision'];

// A designer uploads a design file (a plan, a render, a material board, a PDF) to one of their projects.
export default route({ auth: 'user', roles: ['designer'] }, async (req, res) => {
  const db = getDb();
  const { project_id: projectId, title, kind, status, version, data, mime, name } = req.body || {};
  const project = (await db.query('select id from projects where id = $1 and designer_id = $2', [Number(projectId), req.user.designer_id]))[0];
  if (!project) return res.status(404).json({ error: 'not found' });
  const text = String(title || '').trim().slice(0, 120);
  if (!text) return res.status(400).json({ error: 'Give the design a title.' });
  const file = inspectUpload(data, mime, { allowPdf: true });
  if (file.error) return res.status(400).json({ error: file.error });
  const cleanKind = KINDS.includes(kind) ? kind : 'other';
  const prior = (await db.query('select coalesce(max(version), 0)::int as v from project_designs where project_id = $1 and kind = $2 and title = $3', [project.id, cleanKind, text]))[0].v;
  const saved = (await db.query(
    `insert into files (project_id, kind, mime, size, name, data, uploaded_by) values ($1,'design',$2,$3,$4,decode($5,'base64'),$6) returning id`,
    [project.id, file.mime, file.buf.length, String(name || '').slice(0, 120) || null, file.buf.toString('base64'), req.user.id],
  ))[0];
  const row = (await db.query(
    `insert into project_designs (project_id, title, kind, version, status, image_path, shared_on) values ($1,$2,$3,$4,$5,$6,current_date)
     returning id, title, kind, version, status, image_path, shared_on`,
    [project.id, text, cleanKind, Number.isInteger(version) && version > 0 ? version : prior + 1, STATUSES.includes(status) ? status : 'draft', `/api/file?id=${saved.id}`],
  ))[0];
  return { design: row };
});
