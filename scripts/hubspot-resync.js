// Re-sends fields that are worked out on our side (the source category) to every deal already in HubSpot,
// using batch updates of 100. Safe to re-run. Needs DATABASE_URL and HUBSPOT_TOKEN.
import { neon } from '@neondatabase/serverless';
import { hsBatch, sourceCategory } from '../lib/hubspot.js';

const strip = (v) => String(v || '').replace(/^(["'])(.*)\1$/, '$2');
const sql = neon(strip(process.env.DATABASE_URL));
if (!process.env.HUBSPOT_TOKEN) throw new Error('Set HUBSPOT_TOKEN first');

const rows = await sql.query('select hubspot_deal_id, source from calls where hubspot_deal_id is not null order by id');
let done = 0;
for (let i = 0; i < rows.length; i += 100) {
  const chunk = rows.slice(i, i + 100);
  const res = await hsBatch('deals', 'update', chunk.map((r) => ({ id: r.hubspot_deal_id, properties: { aangan_source: sourceCategory(r.source) } })));
  done += res.length;
}
console.log(`updated ${done} of ${rows.length} deals`);
