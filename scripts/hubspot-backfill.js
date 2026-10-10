// Sends the demo leads to HubSpot so the founder's dashboard has a pipeline to show: won projects with their value,
// and open leads at the stage the designer has reached. Only demo calls without a deal yet are sent, so it is safe to re-run.
// Needs DATABASE_URL and HUBSPOT_TOKEN.
import { neon } from '@neondatabase/serverless';
import { createDeal, STAGE_FOR_STATUS } from '../lib/hubspot.js';

const strip = (v) => String(v || '').replace(/^(["'])(.*)\1$/, '$2');
const sql = neon(strip(process.env.DATABASE_URL));
if (!process.env.HUBSPOT_TOKEN) throw new Error('Set HUBSPOT_TOKEN first');

const rows = await sql.query(
  `select c.id, c.call_id, c.caller_name, c.caller_phone, c.area, c.size_sqft, c.source, c.budget_note, c.tier, c.call_by, c.status, d.name as designer,
          p.value_lakh, p.start_date, p.target_date
     from calls c join designers d on d.id = c.designer_id left join projects p on p.call_id = c.id
    where c.is_demo and c.outcome = 'qualified' and c.hubspot_deal_id is null order by c.created_at`,
);
let done = 0;
for (const r of rows) {
  const extra = { dealstage: STAGE_FOR_STATUS[r.status] || STAGE_FOR_STATUS.new };
  if (r.value_lakh) extra.amount = String(Math.round(Number(r.value_lakh) * 100000));
  else if (['held', 'proposal'].includes(r.status) && r.size_sqft) extra.amount = String(Math.round((Number(r.size_sqft) * 1000) / 10000) * 10000);
  if (r.status === 'won' && r.start_date) extra.closedate = new Date(r.start_date).toISOString().slice(0, 10);
  else if (r.target_date) extra.closedate = new Date(r.target_date).toISOString().slice(0, 10);
  try {
    const res = await createDeal(
      { call_id: r.call_id, caller_name: r.caller_name, caller_phone: r.caller_phone, area: r.area, size_sqft: r.size_sqft, source: r.source, budget_note: r.budget_note },
      { tier: r.tier || 'standard', call_by: new Date(r.call_by || Date.now()), designer_name: r.designer },
      fetch,
      extra,
    );
    await sql.query('update calls set hubspot_deal_id = $1 where id = $2', [res.deal_id, r.id]);
    done++;
    if (done % 10 === 0) console.log(`sent ${done} of ${rows.length}`);
  } catch (e) {
    console.log('failed', r.call_id, String(e.message).slice(0, 160));
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
}
console.log(`sent ${done} of ${rows.length} to HubSpot`);
