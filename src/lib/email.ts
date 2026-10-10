import { CRITERIA, CRITERION_LABELS, type CallRow } from "./types";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

const appUrl = () => process.env.APP_URL ?? "";

export function designerEmailHtml(c: CallRow, forwardedBy?: string): string {
  const b = c.brief;
  const rows = CRITERIA.map((k) => {
    const r = c.criteria?.[k];
    return `<tr><td style="padding:4px 8px"><b>${esc(CRITERION_LABELS[k])}</b></td>
      <td style="padding:4px 8px">${esc(r?.status ?? "-")}</td>
      <td style="padding:4px 8px">${r?.evidence_quote ? `&ldquo;${esc(r.evidence_quote)}&rdquo;` : esc(r?.note ?? "")}</td></tr>`;
  }).join("");

  const booking = c.booking_start
    ? `<p><b>Consultation booked:</b> ${esc(new Date(c.booking_start).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" }))} IST${c.booking_url ? ` &middot; <a href="${esc(c.booking_url)}">booking</a>` : ""}</p>`
    : `<p style="background:#fff4e5;padding:8px"><b>No consultation booked on the call.</b> Please call back within 4 hours to fix a time.</p>`;

  return `<div style="font-family:system-ui,sans-serif;max-width:640px">
  <h2 style="margin:0 0 4px">New lead: ${esc(c.caller_name || c.caller_number || "Unnamed caller")} &middot; ${esc(b?.location || "")}</h2>
  <p style="margin:0;color:#555">${esc(c.caller_number ?? "no number")} &middot; ${c.after_hours ? "after-hours call" : "in-hours call"}${forwardedBy ? ` &middot; forwarded by ${esc(forwardedBy)} after review` : ""}</p>
  ${booking}
  <h3>Brief</h3>
  <p>${esc(b?.summary)}</p>
  <ul>
    <li><b>Property:</b> ${esc(b?.property_type)} &middot; ${esc(b?.size)}</li>
    <li><b>Scope:</b> ${esc(b?.scope)}</li>
    <li><b>Timeline:</b> ${esc(b?.timeline)}</li>
    <li><b>Budget (asked on every call, never used to filter):</b> ${esc(b?.budget_stated)}</li>
    ${c.caller_email ? `<li><b>Email:</b> ${esc(c.caller_email)}</li>` : ""}
    <li><b>Decision-maker:</b> ${esc(b?.decision_maker)}</li>
    <li><b>Language:</b> ${esc(b?.language)}</li>
  </ul>
  ${c.uncertainty?.length ? `<p><b>Open points:</b> ${c.uncertainty.map(esc).join(" ")}</p>` : ""}
  ${c.pricing_violation ? `<p style="background:#fde8e8;padding:8px"><b>Warning:</b> the AI may have mentioned a price on this call. Please check the transcript and reset expectations.</p>` : ""}
  <p><b>Reminder:</b> the caller has not been given any price. You give the range on your call.</p>
  ${c.reasons?.length ? `<p><b>Rules:</b> ${c.reasons.map(esc).join("; ")}</p>` : ""}
  <h3>Rubric, with the caller's words</h3>
  <table style="border-collapse:collapse;font-size:14px">${rows}</table>
  <p style="margin-top:16px"><a href="${esc(appUrl())}/lead/${esc(c.id)}" style="background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open lead &amp; accept</a></p>
  <p style="color:#777;font-size:12px">Please accept within 2 working hours, or the front desk is reminded.</p>
  </div>`;
}

export function reminderEmailHtml(c: CallRow): string {
  return `<p>Lead <b>${esc(c.caller_name || c.caller_number)}</b> was sent to ${esc(c.designer_name)} and has not been accepted within 2 working hours.</p>
  <p><a href="${esc(appUrl())}/lead/${esc(c.id)}">Open lead</a>. Please follow up with the designer.</p>`;
}

export function escalationEmailHtml(c: CallRow): string {
  const f = (c.fields ?? {}) as Record<string, unknown>;
  return `<div style="font-family:system-ui,sans-serif;max-width:640px">
  <h2 style="margin:0 0 4px;color:#b91c1c">Existing client: call back within 15 minutes</h2>
  <p><b>${esc(c.caller_name || "Caller")}</b> &middot; ${esc(c.caller_number ?? "no number")}</p>
  <p>${esc(f.notes_from_call ?? c.brief?.summary ?? "")}</p>
  <p><a href="${esc(appUrl())}/lead/${esc(c.id)}">Open the call and transcript</a></p>
  </div>`;
}
