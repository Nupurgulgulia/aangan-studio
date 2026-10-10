import { neon } from "@neondatabase/serverless";
import type { CallRow, Label } from "./types";

let client: ReturnType<typeof neon> | null = null;

function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await sql().query(text, params)) as T[];
}

// Column whitelist: every dynamic column name below is checked against this set,
// so a caller can never inject SQL through a key.
const COLUMNS = new Set([
  "vaani_call_id", "caller_number", "caller_name", "started_at", "duration_sec", "answered_after_sec",
  "after_hours", "answer_trigger", "transcript", "label", "reason", "criteria", "brief", "uncertainty",
  "pricing_violation", "pricing_violation_text", "scoring_error", "status", "designer_name", "designer_email",
  "booking_start", "booking_url", "stage", "stage_changed_at", "accepted_at", "deal_value_inr", "lost_reason",
  "reviewed_by", "reviewed_at", "review_note", "reminded_at", "hubspot_deal_id", "hubspot_error", "email_error",
  "vaani_cost_inr", "ai_cost_inr",
]);
const JSONB = new Set(["criteria", "brief", "uncertainty"]);
const NUMERIC = ["deal_value_inr", "vaani_cost_inr", "ai_cost_inr"] as const;

function entries(fields: Record<string, unknown>) {
  const cols = Object.keys(fields).filter((k) => fields[k] !== undefined);
  for (const c of cols) if (!COLUMNS.has(c)) throw new Error(`unknown column: ${c}`);
  const values = cols.map((c) => {
    const v = fields[c];
    return JSONB.has(c) && v != null ? JSON.stringify(v) : v;
  });
  return { cols, values };
}

/** Postgres returns numeric as string and timestamptz as Date; the app expects number and ISO string. */
function mapRow(r: any): CallRow {
  for (const k of Object.keys(r)) if (r[k] instanceof Date) r[k] = r[k].toISOString();
  for (const k of NUMERIC) if (r[k] != null) r[k] = Number(r[k]);
  return r as CallRow;
}

export async function getCall(id: string): Promise<CallRow | null> {
  const rows = await query("SELECT * FROM calls WHERE id = $1", [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listCalls(since?: Date): Promise<CallRow[]> {
  const rows = since
    ? await query("SELECT * FROM calls WHERE created_at >= $1 ORDER BY created_at DESC LIMIT 2000", [since.toISOString()])
    : await query("SELECT * FROM calls ORDER BY created_at DESC LIMIT 2000");
  return rows.map(mapRow);
}

export async function listInReview(): Promise<CallRow[]> {
  return (await query("SELECT * FROM calls WHERE status = 'in_review' ORDER BY created_at ASC")).map(mapRow);
}

export async function listAwaitingAcceptance(): Promise<CallRow[]> {
  return (
    await query("SELECT * FROM calls WHERE status = 'with_designer' AND accepted_at IS NULL AND reminded_at IS NULL")
  ).map(mapRow);
}

export async function findByVaaniId(
  vaaniCallId: string,
): Promise<{ id: string; label: Label | null; started_at: string } | null> {
  const rows = await query<{ id: string; label: Label | null; started_at: Date | string }>(
    "SELECT id, label, started_at FROM calls WHERE vaani_call_id = $1",
    [vaaniCallId],
  );
  const r = rows[0];
  return r ? { ...r, started_at: new Date(r.started_at).toISOString() } : null;
}

export async function countAssignedDesigners(): Promise<number> {
  const rows = await query<{ n: string }>("SELECT count(*)::text AS n FROM calls WHERE designer_name IS NOT NULL");
  return Number(rows[0]?.n ?? 0);
}

export async function updateCall(id: string, patch: Record<string, unknown>): Promise<void> {
  const { cols, values } = entries(patch);
  if (!cols.length) return;
  const set = cols.map((c, i) => `${c} = $${i + 1}${JSONB.has(c) ? "::jsonb" : ""}`).join(", ");
  await query(`UPDATE calls SET ${set} WHERE id = $${cols.length + 1}`, [...values, id]);
}

/** Insert or merge by vaani_call_id. Only the supplied columns are written on conflict. */
export async function upsertByVaaniId(fields: Record<string, unknown>): Promise<string> {
  const { cols, values } = entries(fields);
  if (!cols.includes("vaani_call_id")) throw new Error("vaani_call_id required");
  const ph = cols.map((c, i) => `$${i + 1}${JSONB.has(c) ? "::jsonb" : ""}`).join(", ");
  const update = cols.filter((c) => c !== "vaani_call_id").map((c) => `${c} = EXCLUDED.${c}`);
  const conflict = update.length ? `DO UPDATE SET ${update.join(", ")}` : "DO UPDATE SET vaani_call_id = EXCLUDED.vaani_call_id";
  const rows = await query<{ id: string }>(
    `INSERT INTO calls (${cols.join(", ")}) VALUES (${ph}) ON CONFLICT (vaani_call_id) ${conflict} RETURNING id`,
    values,
  );
  return rows[0].id;
}
