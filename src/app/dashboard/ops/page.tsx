import { costRatesMissing } from "@/lib/cost";
import { listCalls } from "@/lib/db";
import { inr, opsMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

export default async function Ops({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = Number((await searchParams).days ?? 30) || 30;
  const calls = await listCalls(new Date(Date.now() - days * 86_400_000));
  const m = opsMetrics(calls);
  const c = m.cost;

  return (
    <>
      <h1>Speed &amp; cost</h1>
      <p className="sub">
        Last {days} days &middot; <a href="?days=7">7</a> &middot; <a href="?days=30">30</a> &middot; <a href="?days=90">90</a>
      </p>

      {costRatesMissing() && (
        <div className="warn">Some cost rates are not set (see .env), so the cost figures below are incomplete.</div>
      )}

      <div className="grid">
        <div className="card"><div className="kpi">{m.handled}</div><div className="lbl">Calls handled</div></div>
        <div className="card"><div className="kpi">{m.medianAnswerSec == null ? "n/a" : `${m.medianAnswerSec.toFixed(0)}s`}</div><div className="lbl">Median time to answer</div></div>
        <div className="card"><div className="kpi">{pct(m.afterHoursShare)}</div><div className="lbl">After-hours share</div></div>
        <div className="card"><div className="kpi">{pct(m.unansweredAt48hShare)}</div><div className="lbl">Still unactioned at 48h ({m.unansweredAt48h}) &middot; was ~48%</div></div>
        <div className="card"><div className="kpi">{m.slaBreaches}</div><div className="lbl">Designer SLA breaches (&gt;2 working hrs)</div></div>
        <div className="card"><div className="kpi">{m.pricingFlags}</div><div className="lbl">Calls where AI may have quoted a price</div></div>
      </div>

      <h2>Cost of the tool</h2>
      <div className="grid">
        <div className="card"><div className="kpi">{inr(c.total)}</div><div className="lbl">Total ({inr(c.vaani)} Vaani + {inr(c.ai)} Gemini + {inr(c.fixed)} fixed)</div></div>
        <div className="card"><div className="kpi">{inr(c.perCall)}</div><div className="lbl">Per call</div></div>
        <div className="card"><div className="kpi">{inr(c.perQualified)}</div><div className="lbl">Per qualified lead</div></div>
        <div className="card"><div className="kpi">{inr(c.perBooking)}</div><div className="lbl">Per booking</div></div>
        <div className="card"><div className="kpi">{c.roi == null ? "n/a" : `${c.roi.toFixed(0)}x`}</div><div className="lbl">Won value / tool cost</div></div>
      </div>
      <p className="sub" style={{ marginTop: 12 }}>
        Fixed monthly cost is counted once per view, not pro-rated to the selected window.
      </p>
      {m.scoringErrors > 0 && <div className="bad">{m.scoringErrors} call(s) failed automatic scoring and are waiting in front-desk review.</div>}
    </>
  );
}
