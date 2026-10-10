import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { setStatus } from '../lib/store.js';
import { moveDeal, STAGE_FOR_STATUS } from '../lib/hubspot.js';

// Move a lead along: accepted, called, held, proposal, won, lost, not a fit. Same actions as the Telegram buttons.
// A designer can change only their own leads.
export default route({ auth: 'user', roles: ['designer'] }, async (req, res) => {
  const { id, status } = req.body || {};
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id must be a number' });
  if (!STAGE_FOR_STATUS[status] || status === 'new') return res.status(400).json({ error: 'unknown status' });
  const db = getDb();
  const row = (await db.query('select designer_id, hubspot_deal_id from calls where id = $1 and outcome = $2', [id, 'qualified']))[0];
  if (!row || row.designer_id !== req.user.designer_id) return res.status(404).json({ error: 'not found' });
  await setStatus(db, id, status, `via dashboard by ${req.user.name}`);
  const moved = await moveDeal(row.hubspot_deal_id, status).catch(() => ({ error: 'crm update failed' }));
  return { ok: true, status, moved };
});
