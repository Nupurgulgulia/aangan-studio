import { CUSTOM_PROPERTIES } from '../lib/hubspot.js';

const token = process.env.HUBSPOT_TOKEN;
if (!token) throw new Error('Set HUBSPOT_TOKEN first');

for (const [name, label, type] of CUSTOM_PROPERTIES) {
  const res = await fetch('https://api.hubapi.com/crm/v3/properties/deals', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      name, label, type: type === 'number' ? 'number' : 'string', fieldType: type === 'number' ? 'number' : 'text', groupName: 'dealinformation',
    }),
  });
  const body = await res.json();
  console.log(res.ok ? 'created' : res.status === 409 ? 'exists ' : 'FAILED ', name, res.ok || res.status === 409 ? '' : body.message);
}
