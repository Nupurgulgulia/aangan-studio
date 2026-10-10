import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';

const VAANI_AGENT = 'https://app.vaanivoice.ai/design/agents/6c4a0a66-1a3a-4ce4-b678-d44b92849579/overview';

// The test console behind the "Chayya" login: what the voice agent has done, so a test call can be checked end to end.
// For every call it shows which of the follow-up steps happened (designer assigned, calendar booked, Telegram, WhatsApp
// draft, HubSpot deal). Only this login can open it.
export default route({ method: 'GET', auth: 'user', roles: ['chayya'] }, async () => {
  const db = getDb();
  const calls = await db.query(
    `select c.id, c.created_at, c.caller_name, c.caller_phone, c.project_type, c.area, c.outcome, c.tier, c.status, c.summary,
            c.slot_start, c.call_by, c.is_demo, c.decline_reason, c.duration_sec,
            (c.transcript is not null and c.transcript <> '') as has_transcript,
            (c.hubspot_deal_id is not null) as has_deal, d.name as designer,
            (select coalesce(json_agg(json_build_object('channel', m.channel, 'status', m.status)), '[]'::json)
               from messages m where m.call_id = c.id) as messages
       from calls c left join designers d on d.id = c.designer_id
      order by c.created_at desc limit 40`,
  );
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const counts = (await db.query(
    `select count(*)::int as total,
            count(*) filter (where outcome = 'qualified')::int as booked,
            count(*) filter (where outcome = 'declined')::int as declined,
            count(*) filter (where outcome = 'escalated')::int as escalated
       from calls where created_at >= $1 and not is_demo`,
    [since],
  ))[0];
  const designers = await db.query('select id, name from designers where active order by rr_order');
  const next = (await db.query('select next_index from rr_state where id = 1'))[0]?.next_index ?? 0;
  return {
    agent: { name: 'Chayya', vaani_url: VAANI_AGENT, languages: 'English, Hindi, Marathi' },
    counts,
    next_designer: designers.length ? designers[next % designers.length].name : null,
    system: {
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      hubspot: Boolean(process.env.HUBSPOT_TOKEN),
      whatsapp: false,
    },
    calls,
  };
});
