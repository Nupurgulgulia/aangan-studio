import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { DEFAULT_HOURS, SLOT_MINUTES } from '../lib/time.js';

// The 14 designer calendars for the next week. A designer sees their own bookings in full and everyone
// else's as plain "busy".
export default route({ method: 'GET', auth: 'user', roles: ['designer'] }, async (req) => {
  const db = getDb();
  const designers = await db.query('select id, name, rr_order from designers where active order by rr_order');
  const rows = await db.query(
    `select b.designer_id, b.start_at, b.end_at, b.kind, b.title, b.location, b.project_id, c.id as call_row_id, c.caller_name,
            coalesce(c.area, p.area) as area, c.tier, c.status, c.window_missed, p.name as project_name
       from bookings b left join calls c on c.id = b.call_id left join projects p on p.id = b.project_id
      where b.start_at >= now() - interval '1 day' and b.start_at < now() + interval '8 days'
      order by b.start_at`,
  );
  const mine = req.user.role === 'designer';
  const bookings = rows.map((b) =>
    mine && b.designer_id !== req.user.designer_id ? { designer_id: b.designer_id, start_at: b.start_at, end_at: b.end_at, busy: true } : { ...b, title: b.title || (b.caller_name ? `Consultation · ${b.caller_name}` : 'Consultation') },
  );
  const next = await db.query('select next_index from rr_state where id = 1');
  return {
    designers, bookings, hours: DEFAULT_HOURS, slot_minutes: SLOT_MINUTES,
    next_designer: mine ? null : designers[next[0]?.next_index ?? 0]?.name ?? null,
  };
});
