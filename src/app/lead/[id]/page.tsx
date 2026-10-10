import { notFound } from "next/navigation";
import { getCall } from "@/lib/db";
import { CRITERIA, CRITERION_LABELS } from "@/lib/types";
import { Actions } from "./actions";

export const dynamic = "force-dynamic";

export default async function Lead({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCall(id);
  if (!c) notFound();
  const b = c.brief;

  return (
    <>
      <h1>{c.caller_name || c.caller_number || "Phone enquiry"}</h1>
      <p className="sub">
        {c.caller_number} &middot; {c.after_hours ? "after-hours" : "in-hours"} &middot;{" "}
        <span className={`pill ${c.label}`}>{c.label ?? "unscored"}</span> &middot; stage: {c.stage}
        {c.designer_name ? ` · designer: ${c.designer_name}` : ""}
      </p>

      {c.pricing_violation && (
        <div className="bad">
          <b>The AI may have quoted a price on this call.</b> Check the transcript and reset expectations.
        </div>
      )}
      {c.email_error && <div className="bad">Designer email failed: {c.email_error}. Forward this lead manually.</div>}
      {c.scoring_error && <div className="bad">Automatic scoring failed: {c.scoring_error}</div>}

      <Actions id={c.id} status={c.status} stage={c.stage} accepted={!!c.accepted_at} dealValue={c.deal_value_inr} />

      {b && (
        <>
          <h2>Brief</h2>
          <div className="card">
            <p style={{ marginTop: 0 }}>{b.summary}</p>
            <div>Property: {b.property_type} &middot; {b.size} &middot; {b.location}</div>
            <div>Scope: {b.scope}</div>
            <div>Timeline: {b.timeline}</div>
            <div>Budget mentioned: {b.budget_stated}</div>
            <div>Decision-maker: {b.decision_maker}</div>
            <div>Language: {b.language}</div>
            {c.booking_start && (
              <div>Booked: {new Date(c.booking_start).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" })}</div>
            )}
          </div>
        </>
      )}

      {c.criteria && (
        <>
          <h2>Why: rubric, one line per criterion</h2>
          <p className="sub">{c.reason}</p>
          <table>
            <thead><tr><th>Criterion</th><th>Result</th><th>Caller&apos;s words / note</th></tr></thead>
            <tbody>
              {CRITERIA.map((k) => {
                const r = c.criteria![k];
                return (
                  <tr key={k}>
                    <td>{CRITERION_LABELS[k]}</td>
                    <td className={r.status}>{r.status}</td>
                    <td>{r.evidence_quote ? <>&ldquo;{r.evidence_quote}&rdquo;</> : r.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {c.uncertainty?.length ? <p className="sub">Open points: {c.uncertainty.join(" ")}</p> : null}
        </>
      )}

      <h2>Transcript</h2>
      <pre>{c.transcript || "(empty)"}</pre>
    </>
  );
}
