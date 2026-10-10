import { route, withCallId } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { logCall } from '../lib/store.js';
import { notifyEscalation } from '../lib/handoff.js';

const OUTCOMES = ['declined', 'escalated', 'missed', 'info_only', 'qualified'];

// Voice agent tool and post-call webhook: records every non-booked call, and adds transcript,
// duration and cost to any call. An escalation also pings Telegram, because a person owes a callback.
export default route({}, async (req) => {
  const data = withCallId(req.body || {});
  if (!OUTCOMES.includes(data.outcome)) return { error: `outcome must be one of ${OUTCOMES.join(', ')}` };
  const row = await logCall(getDb(), data);
  const alert = row.outcome === 'escalated'
    ? await notifyEscalation({ id: row.id, caller_name: data.caller_name, caller_phone: data.caller_phone, summary: data.summary }).catch((e) => ({ skipped: true, reason: String(e.message) }))
    : undefined;
  return { logged: true, id: row.id, outcome: row.outcome, ...(alert ? { alert } : {}) };
});
