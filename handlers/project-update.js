import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { updateDeal } from '../lib/hubspot.js';

const STAGES = ['design', 'approvals', 'execution', 'finishing', 'handover'];

// Move a project along: stage, progress, target date, notes. Own projects only.
export default route({ auth: 'user', roles: ['designer'] }, async (req, res) => {
  const db = getDb();
  const { id, stage, progress_pct: progress, target_date: target, summary, value_lakh: value } = req.body || {};
  const project = (await db.query('select id, stage, progress_pct, target_date, summary, value_lakh from projects where id = $1 and designer_id = $2', [Number(id), req.user.designer_id]))[0];
  if (!project) return res.status(404).json({ error: 'not found' });
  if (stage !== undefined && !STAGES.includes(stage)) return res.status(400).json({ error: 'Unknown stage.' });
  if (progress !== undefined && !(Number.isInteger(progress) && progress >= 0 && progress <= 100)) return res.status(400).json({ error: 'Progress must be a whole number from 0 to 100.' });
  if (target !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(target))) return res.status(400).json({ error: 'Use a date like 2026-12-05.' });
  await db.query('update projects set stage = $2, progress_pct = $3, target_date = $4, summary = $5, value_lakh = $6 where id = $1', [
    project.id, stage ?? project.stage, progress ?? project.progress_pct, target ?? project.target_date, summary === undefined ? project.summary : String(summary).slice(0, 600), value === undefined ? project.value_lakh : (Number(value) > 0 ? Number(value) : null),
  ]);
  if (target !== undefined || value !== undefined) {
    const p = (await db.query('select p.value_lakh, p.target_date, c.hubspot_deal_id from projects p left join calls c on c.id = p.call_id where p.id = $1', [project.id]))[0];
    if (p?.hubspot_deal_id) {
      const props = {};
      if (p.value_lakh) props.amount = String(Math.round(Number(p.value_lakh) * 100000));
      if (p.target_date) props.closedate = new Date(p.target_date).toISOString().slice(0, 10);
      if (Object.keys(props).length) await updateDeal(p.hubspot_deal_id, props).catch(() => {});
    }
  }
  return { ok: true };
});
