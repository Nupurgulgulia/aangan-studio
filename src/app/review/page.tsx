import { listInReview } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Review() {
  const calls = await listInReview();

  return (
    <>
      <h1>Front-desk review</h1>
      <p className="sub">
        Borderline and not-a-fit calls. The AI never turns a lead away on its own: someone here decides, the same working day.
      </p>
      <table>
        <thead><tr><th>Received</th><th>Caller</th><th>AI label</th><th>Why</th><th></th></tr></thead>
        <tbody>
          {calls.length === 0 && <tr><td colSpan={5}>Nothing waiting.</td></tr>}
          {calls.map((c) => (
            <tr key={c.id}>
              <td>{new Date(c.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" })}</td>
              <td>{c.caller_name || c.caller_number || "unknown"}</td>
              <td><span className={`pill ${c.label}`}>{c.label}</span></td>
              <td>{c.reason}{c.email_error ? " (designer email failed: needs forwarding)" : ""}</td>
              <td><a href={`/lead/${c.id}`}>Open</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
