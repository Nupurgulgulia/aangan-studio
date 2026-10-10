import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { sourceCategory } from '../lib/hubspot.js';

const STAGES = ['new', 'accepted', 'called', 'held', 'proposal', 'won', 'lost', 'not_a_fit'];

// Nikhil's view: what the phone line is generating and what it costs, so he never pulls the numbers by hand.
// The same deals live in HubSpot; this page draws the five breakdowns the free HubSpot plan cannot chart.
// ?demo=0 leaves the demo data out. Only the founder login can open it.
export default route({ method: 'GET', auth: 'user', roles: ['founder'] }, async (req) => {
  const db = getDb();
  const withDemo = req.query?.demo !== '0';
  const demo = withDemo ? '' : 'and not c.is_demo';

  const calls = await db.query(
    `select c.outcome, c.status, c.tier, c.source, c.created_at, c.call_by, c.cost_inr, c.duration_sec, c.window_missed,
            d.name as designer, p.value_lakh
       from calls c left join designers d on d.id = c.designer_id
       left join projects p on p.call_id = c.id
      where true ${demo}`,
  );
  const leads = calls.filter((c) => c.outcome === 'qualified');
  const won = leads.filter((c) => c.status === 'won');
  const count = (rows, key) => {
    const m = new Map();
    for (const r of rows) m.set(key(r), (m.get(key(r)) || 0) + 1);
    return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
  };
  const byDesigner = new Map();
  for (const l of leads) {
    const d = byDesigner.get(l.designer) || { label: l.designer, leads: 0, won: 0, value_lakh: 0 };
    d.leads++;
    if (l.status === 'won') { d.won++; d.value_lakh += Number(l.value_lakh || 0); }
    byDesigner.set(l.designer, d);
  }
  const cost = calls.reduce((s, c) => s + Number(c.cost_inr || 0), 0);
  const minutes = calls.reduce((s, c) => s + Number(c.duration_sec || 0), 0) / 60;

  return {
    includes_demo: withDemo,
    totals: {
      calls: calls.length,
      leads: leads.length,
      declined: calls.filter((c) => c.outcome === 'declined').length,
      escalated: calls.filter((c) => c.outcome === 'escalated').length,
      won: won.length,
      won_value_lakh: Math.round(won.reduce((s, c) => s + Number(c.value_lakh || 0), 0) * 10) / 10,
      window_missed: leads.filter((c) => c.window_missed).length,
      cost_inr: Math.round(cost),
      minutes: Math.round(minutes),
      cost_per_lead_inr: leads.length ? Math.round(cost / leads.length) : null,
    },
    by_stage: STAGES.map((s) => ({ label: s, n: leads.filter((l) => l.status === s).length })),
    by_tier: ['hot', 'priority', 'standard'].map((t) => ({ label: t, n: leads.filter((l) => l.tier === t).length })),
    by_source: count(leads, (l) => sourceCategory(l.source)),
    by_designer: [...byDesigner.values()].sort((a, b) => b.leads - a.leads),
    won_by_month: count(won, (l) => new Date(l.created_at).toISOString().slice(0, 7)).sort((a, b) => a.label.localeCompare(b.label)),
  };
});
