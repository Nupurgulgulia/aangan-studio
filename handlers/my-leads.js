import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';

// A designer's own qualified leads, soonest call-by first. Which designer is decided by the login, not the request.
export default route({ method: 'GET', auth: 'user', roles: ['designer'] }, async (req) => {
  const leads = await getDb().query(
    `select c.id, c.created_at, c.caller_name, c.caller_phone, c.project_type, c.area, c.size_sqft, c.timeline_text,
            c.decision_maker, c.budget_note, c.source, c.tier, c.tier_reasons, c.call_by, c.slot_start, c.window_missed,
            c.status, c.summary
       from calls c
      where c.designer_id = $1 and c.outcome = 'qualified'
      order by (c.status in ('won','lost','not_a_fit','done')), c.call_by`,
    [req.user.designer_id],
  );
  return { leads };
});
