import { route, withCallId } from '../lib/http.js';
import { getDb } from '../lib/db.js';
import { bookLead } from '../lib/store.js';
import { notifyBooking } from '../lib/handoff.js';

// Voice agent tool: called once a lead is qualified. Picks the next designer, books the slot,
// messages the designer on Telegram and pushes the lead to the CRM.
export default route({}, async (req) => {
  const lead = withCallId(req.body || {});
  const booking = await bookLead(getDb(), lead);
  if (booking.error) return { booked: false, spoken: 'Our team will call you shortly to fix a time.', ...booking };
  if (booking.repeated) return { booked: true, repeated: true, spoken: booking.spoken };

  return {
    booked: true,
    designer: booking.designer_name,
    tier: booking.tier,
    slot: booking.slot,
    window_missed: booking.window_missed,
    spoken: booking.spoken,
    notifications: await notifyBooking(lead, booking),
  };
});
