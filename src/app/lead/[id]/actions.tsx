"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STAGE_OPTIONS = ["accepted", "called", "proposal", "won", "lost"];

export function Actions(p: { id: string; status: string; stage: string; accepted: boolean; dealValue: number | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [who, setWho] = useState("");
  const [note, setNote] = useState("");
  const [stage, setStage] = useState(p.stage === "new" ? "called" : p.stage);
  const [value, setValue] = useState(p.dealValue ? String(p.dealValue) : "");
  const [lostReason, setLostReason] = useState("");

  async function send(body: object) {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/leads/${p.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Something went wrong; check the fields.");
      return;
    }
    router.refresh();
  }

  if (p.status === "in_review") {
    return (
      <div className="card">
        <b>Front-desk decision</b>
        <div className="row">
          <input placeholder="Your name" value={who} onChange={(e) => setWho(e.target.value)} />
        </div>
        <div className="row">
          <button disabled={busy || !who} onClick={() => send({ action: "review_forward", reviewer: who })}>
            Send to designer
          </button>
        </div>
        <div className="row">
          <input style={{ flex: 1, minWidth: 220 }} placeholder="Reason for closing (shown in lost reasons)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="sec" disabled={busy || !who || note.length < 3} onClick={() => send({ action: "review_close", reviewer: who, note })}>
            Close as not a fit
          </button>
        </div>
        {err && <div className="bad">{err}</div>}
      </div>
    );
  }

  return (
    <div className="card">
      <b>Designer actions</b>
      <div className="row">
        {!p.accepted && <button disabled={busy} onClick={() => send({ action: "accept" })}>Accept lead</button>}
        <select value={stage} onChange={(e) => setStage(e.target.value)}>
          {STAGE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input placeholder="Deal value ₹" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))} />
        {stage === "lost" && <input placeholder="Lost reason (required)" value={lostReason} onChange={(e) => setLostReason(e.target.value)} />}
        <button
          className="sec"
          disabled={busy}
          onClick={() =>
            send({
              action: "set_stage",
              stage,
              ...(value ? { deal_value_inr: Number(value) } : {}),
              ...(stage === "lost" ? { lost_reason: lostReason } : {}),
            })
          }
        >
          Update stage
        </button>
      </div>
      {err && <div className="bad">{err}</div>}
    </div>
  );
}
