// HubSpot free plan: one deal pipeline, 10 custom properties, so we use 8 and the default pipeline.
const API = 'https://api.hubapi.com';

export const STAGE_FOR_STATUS = {
  new: 'appointmentscheduled',
  accepted: 'appointmentscheduled',
  called: 'appointmentscheduled',
  held: 'qualifiedtobuy',
  proposal: 'presentationscheduled',
  won: 'closedwon',
  lost: 'closedlost',
  not_a_fit: 'closedlost',
};

export const CUSTOM_PROPERTIES = [
  ['aangan_tier', 'Aangan tier', 'string'],
  ['aangan_call_by', 'Aangan call-by time', 'string'],
  ['aangan_designer', 'Aangan designer', 'string'],
  ['aangan_area', 'Aangan area', 'string'],
  ['aangan_size_sqft', 'Aangan size (sq ft)', 'number'],
  ['aangan_source', 'Aangan source', 'string'],
  ['aangan_call_id', 'Aangan call ID', 'string'],
  ['aangan_budget_note', 'Aangan budget note', 'string'],
];

async function hs(path, method, body, fetchImpl = fetch) {
  let res;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetchImpl(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status !== 429) break; // over the rate limit: wait a second and try again
    await new Promise((r) => setTimeout(r, 1100));
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`HubSpot ${method} ${path} failed: ${res.status} ${json.message || text}`);
  return json;
}

// extra: any other deal properties, for example amount, dealstage or closedate when backfilling.
export async function createDeal(lead, booking, fetchImpl = fetch, extra = {}) {
  if (!process.env.HUBSPOT_TOKEN) return { skipped: true, reason: 'no HubSpot token' };
  const [first, ...rest] = (lead.caller_name || 'Unknown caller').split(' ');
  const contact = await hs('/crm/v3/objects/contacts', 'POST', {
    properties: { firstname: first, lastname: rest.join(' ') || undefined, phone: lead.caller_phone || undefined },
  }, fetchImpl);
  const deal = await hs('/crm/v3/objects/deals', 'POST', {
    properties: {
      dealname: `${lead.caller_name || 'Phone enquiry'} · ${lead.area || 'Pune'}`,
      pipeline: 'default',
      dealstage: STAGE_FOR_STATUS.new,
      aangan_tier: booking.tier,
      aangan_call_by: booking.call_by.toISOString(),
      aangan_designer: booking.designer_name,
      aangan_area: lead.area || '',
      aangan_size_sqft: lead.size_sqft ? Number(lead.size_sqft) : undefined,
      aangan_source: lead.source || '',
      aangan_call_id: lead.call_id,
      aangan_budget_note: lead.budget_note || 'not stated',
      ...extra,
    },
  }, fetchImpl);
  await hs(`/crm/v4/objects/deals/${deal.id}/associations/default/contacts/${contact.id}`, 'PUT', undefined, fetchImpl);
  return { deal_id: deal.id, contact_id: contact.id };
}

export async function moveDeal(dealId, status, fetchImpl = fetch) {
  if (!process.env.HUBSPOT_TOKEN || !dealId) return { skipped: true };
  const stage = STAGE_FOR_STATUS[status];
  if (!stage) return { skipped: true, reason: 'no stage for status' };
  await hs(`/crm/v3/objects/deals/${dealId}`, 'PATCH', { properties: { dealstage: stage } }, fetchImpl);
  return { moved: stage };
}

// Keep the deal's value and expected close date in step with the project the designer starts or edits.
export async function updateDeal(dealId, properties, fetchImpl = fetch) {
  if (!process.env.HUBSPOT_TOKEN || !dealId) return { skipped: true };
  await hs(`/crm/v3/objects/deals/${dealId}`, 'PATCH', { properties }, fetchImpl);
  return { updated: Object.keys(properties) };
}
