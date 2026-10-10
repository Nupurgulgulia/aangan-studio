import type { CallRow, Stage } from "./types";

const API = "https://api.hubapi.com";

async function hs(path: string, init: RequestInit = {}) {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) throw new Error("HUBSPOT_TOKEN is not set");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`HubSpot ${res.status} ${path}: ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

async function findOrCreateContact(c: CallRow): Promise<string | null> {
  // Test calls and withheld numbers have no real phone; don't create junk contacts.
  if (!c.caller_number || !/^\+?[0-9]{7,15}$/.test(c.caller_number)) return null;
  const found = await hs("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "phone", operator: "EQ", value: c.caller_number }] }],
      limit: 1,
    }),
  });
  if (found?.results?.[0]) return found.results[0].id;
  const created = await hs("/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties: { phone: c.caller_number, firstname: c.caller_name || "Caller", ...(c.caller_email ? { email: c.caller_email } : {}) } }),
  });
  return created.id;
}

export const stageId = (kind: "new" | "review" | "won" | "lost") =>
  ({
    new: process.env.HUBSPOT_STAGE_NEW || "appointmentscheduled",
    review: process.env.HUBSPOT_STAGE_REVIEW || "qualifiedtobuy",
    won: process.env.HUBSPOT_STAGE_WON || "closedwon",
    lost: process.env.HUBSPOT_STAGE_LOST || "closedlost",
  })[kind];

/**
 * Qualified and review leads become deals (the Neon row stays the source of truth).
 * Booked -> "appointment scheduled"; otherwise "qualified to buy". The caller's stated budget
 * (upper end) is the deal amount: CRM tracking only, it never affects the outcome.
 */
export async function createDeal(c: CallRow): Promise<string> {
  const contactId = await findOrCreateContact(c);
  const f = (c.fields ?? null) as { budget_inr?: { max?: number } | null; budget_text?: string } | null;
  const body: any = {
    properties: {
      dealname: `${c.caller_name || c.caller_number || "Phone enquiry"} - ${c.brief?.location || "Pune"}`,
      dealstage: c.label === "qualified" && c.booking_start ? stageId("new") : stageId("review"),
      description: `${c.brief?.summary ?? ""}${f?.budget_text ? `\nBudget (caller's words): ${f.budget_text}` : ""}\n\nAI label: ${c.label}. ${(c.reasons ?? []).join("; ")}\nLead: ${process.env.APP_URL}/lead/${c.id}`.slice(0, 5000),
      ...(f?.budget_inr?.max ? { amount: String(f.budget_inr.max) } : {}),
    },
  };
  if (contactId) {
    body.associations = [
      { to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] },
    ];
  }
  const deal = await hs("/crm/v3/objects/deals", { method: "POST", body: JSON.stringify(body) });
  return deal.id as string;
}

export async function syncDealOutcome(
  dealId: string,
  stage: Stage,
  opts: { amountInr?: number | null; lostReason?: string | null },
): Promise<void> {
  const properties: Record<string, string> = {};
  if (stage === "won") properties.dealstage = stageId("won");
  else if (stage === "lost") {
    properties.dealstage = stageId("lost");
    if (opts.lostReason) properties.description = `Lost: ${opts.lostReason}`;
  } else properties.dealstage = stageId("new");
  if (opts.amountInr != null) properties.amount = String(opts.amountInr);
  await hs(`/crm/v3/objects/deals/${dealId}`, { method: "PATCH", body: JSON.stringify({ properties }) });
}
