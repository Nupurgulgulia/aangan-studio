import { route } from '../lib/http.js';
import { getDb } from '../lib/db.js';

// Voice platform webhook or sync job: attaches the transcript, recording link, length and cost to a call
// the agent already logged. Nothing here changes the outcome.
export default route({}, async (req, res) => {
  const { call_id, transcript, recording_url, duration_sec, cost_inr } = req.body || {};
  if (!call_id) return res.status(400).json({ error: 'call_id is required' });
  if (recording_url && !/^https:\/\//i.test(recording_url)) return res.status(400).json({ error: 'recording_url must be an https link' });
  const rows = await getDb().query(
    `update calls set transcript = coalesce($2, transcript), recording_url = coalesce($3, recording_url),
                      duration_sec = coalesce($4, duration_sec), cost_inr = coalesce($5, cost_inr)
      where call_id = $1 returning id`,
    [call_id, transcript || null, recording_url || null, duration_sec ?? null, cost_inr ?? null],
  );
  return { updated: rows.length };
});
