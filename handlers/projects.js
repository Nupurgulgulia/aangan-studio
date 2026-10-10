import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';

// A designer's own ongoing projects, with the next thing on the calendar for each.
export default route({ method: 'GET', auth: 'user', roles: ['designer'] }, async (req) => {
  const db = getDb();
  const projects = await db.query(
    `select p.id, p.code, p.name, p.customer_name, p.customer_phone, p.area, p.site_address, p.project_type, p.size_sqft, p.stage, p.progress_pct,
            p.start_date, p.target_date, p.value_lakh, p.hero_photo,
            (select count(*)::int from project_designs d where d.project_id = p.id) as designs,
            (select count(*)::int from project_photos f where f.project_id = p.id) as photos
       from projects p where p.designer_id = $1
      order by array_position(array['handover','finishing','execution','approvals','design'], p.stage), p.target_date`,
    [req.user.designer_id],
  );
  const next = await db.query(
    `select distinct on (project_id) project_id, kind, title, start_at, location
       from bookings where designer_id = $1 and project_id is not null and start_at > now() order by project_id, start_at`,
    [req.user.designer_id],
  );
  const byProject = new Map(next.map((n) => [n.project_id, n]));
  const unlinked = await db.query(
    `select c.id, c.caller_name, c.caller_phone, c.area, c.project_type, c.size_sqft, c.created_at from calls c
      where c.designer_id = $1 and c.status = 'won' and c.outcome = 'qualified' and not exists (select 1 from projects p where p.call_id = c.id)
      order by c.created_at desc`,
    [req.user.designer_id],
  );
  return { projects: projects.map((p) => ({ ...p, next_event: byProject.get(p.id) || null })), won_without_project: unlinked };
});
