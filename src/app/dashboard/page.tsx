import { listCalls } from "@/lib/db";
import { inr, pipelineMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = Number((await searchParams).days ?? 30) || 30;
  const calls = await listCalls(new Date(Date.now() - days * 86_400_000));
  const m = pipelineMetrics(calls);

  return (
    <>
      <h1>Pipeline &amp; revenue</h1>
      <p className="sub">
        Last {days} days &middot; <a href="?days=7">7</a> &middot; <a href="?days=30">30</a> &middot; <a href="?days=90">90</a>
      </p>

      <div className="grid">
        <div className="card"><div className="kpi">{m.total}</div><div className="lbl">Phone enquiries</div></div>
        <div className="card"><div className="kpi qualified">{m.qualified}</div><div className="lbl">Qualified</div></div>
        <div className="card"><div className="kpi borderline">{m.borderline}</div><div className="lbl">Borderline (human review)</div></div>
        <div className="card"><div className="kpi not_a_fit">{m.notAFit}</div><div className="lbl">Not a fit (human review)</div></div>
        <div className="card"><div className="kpi">{inr(m.wonValue)}</div><div className="lbl">Won &middot; {m.wonCount} deals</div></div>
        <div className="card"><div className="kpi">{inr(m.lostValue)}</div><div className="lbl">Lost with a value &middot; {m.lostCount} closed-lost</div></div>
      </div>

      <h2>Where deals get stuck</h2>
      <table>
        <thead><tr><th>Stage</th><th>Open leads</th><th>Median days in stage</th></tr></thead>
        <tbody>
          {m.stageRows.map((r) => (
            <tr key={r.stage}>
              <td>{r.stage}</td><td>{r.count}</td>
              <td>{r.medianDays == null ? "-" : r.medianDays.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Why leads are lost</h2>
      <table>
        <thead><tr><th>Reason</th><th>Count</th></tr></thead>
        <tbody>
          {m.lostReasons.length ? m.lostReasons.map(([r, n]) => <tr key={r}><td>{r}</td><td>{n}</td></tr>) : <tr><td colSpan={2}>None yet</td></tr>}
        </tbody>
      </table>

      <h2>By designer</h2>
      <table>
        <thead><tr><th>Designer</th><th>Leads received</th><th>Won</th></tr></thead>
        <tbody>
          {m.designerRows.length ? m.designerRows.map((d) => <tr key={d.name}><td>{d.name}</td><td>{d.received}</td><td>{d.won}</td></tr>) : <tr><td colSpan={3}>None yet</td></tr>}
        </tbody>
      </table>
    </>
  );
}
