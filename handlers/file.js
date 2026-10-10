import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';

// Serves an uploaded photo or design to the designer who owns the project. Everything else looks like it does not exist.
export default route({ method: 'GET', auth: 'user', roles: ['designer'] }, async (req, res) => {
  const id = Number(req.query?.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id must be a number' });
  const row = (await getDb().query(
    `select f.mime, f.name, encode(f.data, 'base64') as data from files f join projects p on p.id = f.project_id
      where f.id = $1 and p.designer_id = $2`,
    [id, req.user.designer_id],
  ))[0];
  if (!row) return res.status(404).json({ error: 'not found' });
  // Images get a locked-down policy. PDFs need the browser's own viewer, which a sandbox policy would block.
  const headers = { 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline' };
  if (row.mime.startsWith('image/')) headers['content-security-policy'] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";
  return res.sendFile(Buffer.from(row.data, 'base64'), row.mime, headers);
});
