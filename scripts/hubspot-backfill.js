// Sends demo leads (and any real booked call whose deal failed) to HubSpot, so the founder's dashboard has a pipeline:
// won projects with their value, and open leads at the stage the designer has reached. Uses HubSpot's batch endpoints,
// 100 records per request. Only calls without a deal yet are sent, so it is safe to re-run.
// Needs DATABASE_URL and HUBSPOT_TOKEN.
import { neon } from '@neondatabase/serverless';
import { dealProperties, hsBatch, STAGE_FOR_STATUS } from '../lib/hubspot.js';

const strip = (v) => String(v || '').replace(/^(["'])(.*)\1$/, '$2');
const sql = neon(strip(process.env.DATABASE_URL));
if (!process.env.HUBSPOT_TOKEN) throw new Error('Set HUBSPOT_TOKEN first');

const rows = await sql.query(
  `select c.id, c.call_id, c.created_at, c.caller_name, c.caller_phone, c.area, c.size_sqft, c.source, c.budget_note, c.tier, c.call_by,
          c.status, d.name as designer, p.value_lakh, p.start_date, p.target_date
     from calls c join designers d on d.id = c.designer_id left join projects p on p.call_id = c.id
    where c.outcome = 'qualified' and c.hubspot_deal_id is null order by c.created_at`,
);

// Every deal gets a close date, so date-filtered report tiles are never empty.
function closeDate(r) {
  if (r.status === 'won' && r.start_date) return new Date(r.start_date);
  if (r.target_date) return new Date(r.target_date);
  const d = new Date(r.created_at);
  d.setDate(d.getDate() + (['lost', 'not_a_fit'].includes(r.status) ? 7 : 45));
  return d;
}

let done = 0;
for (let i = 0; i < rows.length; i += 100) {
  const chunk = rows.slice(i, i + 100);
  const contacts = await hsBatch('contacts', 'create', chunk.map((r) => {
    const [first, ...rest] = (r.caller_name || 'Unknown caller').split(' ');
    return { properties: { firstname: first, lastname: rest.join(' ') || undefined, phone: r.caller_phone || undefined } };
  }));
  const deals = await hsBatch('deals', 'create', chunk.map((r, k) => {
    const extra = { dealstage: STAGE_FOR_STATUS[r.status] || STAGE_FOR_STATUS.new, closedate: closeDate(r).toISOString().slice(0, 10) };
    if (r.value_lakh) extra.amount = String(Math.round(Number(r.value_lakh) * 100000));
    else if (['held', 'proposal'].includes(r.status) && r.size_sqft) extra.amount = String(Math.round((Number(r.size_sqft) * 1000) / 10000) * 10000);
    return {
      properties: dealProperties(
        { call_id: r.call_id, caller_name: r.caller_name, area: r.area, size_sqft: r.size_sqft, source: r.source, budget_note: r.budget_note },
        { tier: r.tier || 'standard', call_by: new Date(r.call_by || r.created_at), designer_name: r.designer },
        extra,
      ),
      // 3 = deal to contact, HubSpot's built-in association.
      associations: [{ to: { id: contacts[k].id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }] }],
    };
  }));
  // Batch results come back in request order; match on our own call id to be safe.
  const byCallId = new Map(deals.map((d) => [d.properties.aangan_call_id, d.id]));
  for (const r of chunk) {
    const id = byCallId.get(r.call_id);
    if (id) { await sql.query('update calls set hubspot_deal_id = $1 where id = $2', [id, r.id]); done++; }
  }
  console.log(`sent ${done} of ${rows.length}`);
}
console.log(`sent ${done} of ${rows.length} to HubSpot`);
