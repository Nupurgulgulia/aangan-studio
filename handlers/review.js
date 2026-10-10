import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { bookLead, setStatus } from '../lib/store.js';
import { notifyBooking } from '../lib/handoff.js';

// Actions on a call the bot could not finish alone (any signed-in designer):
//   reviewed - a declined call was read and the decline is right
//   done     - an escalation or callback has been handled
//   reverse  - the decline was wrong: book the caller with the next designer, marked hot
export default route({ auth: 'user', roles: ['designer'] }, async (req, res) => {
  const { id, action } = req.body || {};
  const note = String(req.body?.note || '').trim().slice(0, 300);
  const db = getDb();
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id must be a number' });

  if (action === 'reviewed') {
    await db.query('update calls set reviewed = true where id = $1', [id]);
    await db.query('insert into status_events (call_id, status, note) values ($1,$2,$3)', [id, 'reviewed', `Decline checked by ${req.user.name}`]);
    return { ok: true };
  }
  if (action === 'done') {
    await setStatus(db, id, 'done', `Closed by ${req.user.name}`);
    return { ok: true };
  }
  if (action === 'reverse') {
    const call = (await db.query("select * from calls where id = $1 and outcome = 'declined'", [id]))[0];
    if (!call) return res.status(400).json({ error: 'Only a declined call can be reversed.' });
    const lead = {
      call_id: call.call_id, caller_name: call.caller_name, caller_phone: call.caller_phone, project_type: call.project_type,
      area: call.area, size_sqft: call.size_sqft, timeline_text: call.timeline_text, decision_maker: call.decision_maker,
      source: call.source, budget_note: call.budget_note, reversed_decline: true,
      summary: `Declined by the agent, reversed by ${req.user.name}${note ? ` (${note})` : ''}. Original reason: ${call.decline_reason || 'not recorded'}. ${call.summary || ''}`.trim(),
    };
    const booking = await bookLead(db, lead);
    if (booking.error) return res.status(409).json({ error: 'No designer slot is free in the next week. Call the person back directly.' });
    await db.query('update calls set reviewed = true where id = $1', [id]);
    await db.query('insert into status_events (call_id, status, note) values ($1,$2,$3)', [id, 'reversed', `Decline reversed by ${req.user.name}${note ? `: ${note}` : ''}`]);
    await notifyBooking(lead, booking);
    return { ok: true, designer: booking.designer_name, slot: booking.slot, call_by: booking.call_by };
  }
  return res.status(400).json({ error: 'action must be reviewed, done or reverse' });
});
