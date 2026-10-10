import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { updateDeal } from '../lib/hubspot.js';

// A lead was won: the designer starts the project. The customer details come from what the agent captured on the call.
export default route({ auth: 'user', roles: ['designer'] }, async (req, res) => {
  const db = getDb();
  const { call_id: callId, name, site_address: site, value_lakh: value, start_date: start, target_date: target } = req.body || {};
  const call = (await db.query(
    "select id, caller_name, caller_phone, area, project_type, size_sqft, summary from calls where id = $1 and designer_id = $2 and outcome = 'qualified'",
    [Number(callId), req.user.designer_id],
  ))[0];
  if (!call) return res.status(404).json({ error: 'not found' });
  if ((await db.query('select 1 from projects where call_id = $1', [call.id])).length) return res.status(409).json({ error: 'This lead already has a project.' });
  const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null);
  const amount = Number(value);
  const year = new Date().getUTCFullYear();
  const count = (await db.query('select count(*)::int as n from projects'))[0].n;
  const surname = String(call.caller_name || 'Customer').split(/\s+/).pop();
  const row = (await db.query(
    `insert into projects (code, call_id, designer_id, name, customer_name, customer_phone, area, site_address, project_type, size_sqft, stage, progress_pct, start_date, target_date, value_lakh, summary)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'design',0,coalesce($11, current_date),$12,$13,$14) returning id`,
    [`AS-${year}-${String(count + 1).padStart(3, '0')}-${call.id}`, call.id, req.user.designer_id, String(name || '').trim().slice(0, 100) || `${surname} project`, call.caller_name || 'Customer', call.caller_phone,
      call.area, String(site || '').trim().slice(0, 200) || null, call.project_type, call.size_sqft, day(start), day(target), amount > 0 ? amount : null, call.summary],
  ))[0];
  const deal = (await db.query('select hubspot_deal_id from calls where id = $1', [call.id]))[0]?.hubspot_deal_id;
  if (deal && amount > 0) await updateDeal(deal, { amount: String(Math.round(amount * 100000)), ...(day(target) ? { closedate: day(target) } : {}) }).catch(() => {});
  return { project_id: row.id };
});
