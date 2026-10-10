import { DEFAULT_HOURS, SLOT_MINUTES, addDays, fromIST, startOfISTDay, toIST } from './time.js';

const MIN = 60 * 1000;
export const LEAD_TIME_MINUTES = 15;

// Free 30-minute slots between `from` and `to`, on the half hour, inside studio hours.
export function generateSlots(from, to, booked = new Set(), hours = DEFAULT_HOURS) {
  const slots = [];
  let day = startOfISTDay(from);
  const lastDay = startOfISTDay(to);
  while (day <= lastDay) {
    const t = toIST(day);
    const h = hours[t.weekday];
    if (h) {
      for (let m = h[0]; m + SLOT_MINUTES <= h[1]; m += SLOT_MINUTES) {
        const start = fromIST(t.year, t.month, t.day, m);
        if (start >= from && start <= to && !booked.has(start.getTime())) slots.push(start);
      }
    }
    day = addDays(day, 1);
  }
  return slots;
}

// designers: active designers ordered by rr_order. bookedByDesigner: Map(designerId -> Set(ms)).
// Returns the first designer in rotation (starting at nextIndex) with a free slot before `deadline`.
// If nobody has a slot in the window, falls back to the earliest slot in the next 7 days and says so.
export function pickDesigner({ designers, nextIndex, now, deadline, bookedByDesigner, hours = DEFAULT_HOURS }) {
  const n = designers.length;
  if (n === 0) return null;
  const earliest = new Date(now.getTime() + LEAD_TIME_MINUTES * MIN);
  const skipped = [];

  for (let k = 0; k < n; k++) {
    const idx = (nextIndex + k) % n;
    const d = designers[idx];
    const slots = generateSlots(earliest, deadline, bookedByDesigner.get(d.id) || new Set(), hours);
    if (slots.length) {
      return { designer: d, slot: slots[0], windowMissed: false, skipped, nextIndex: (idx + 1) % n };
    }
    skipped.push(d.id);
  }

  const farLimit = new Date(now.getTime() + 7 * 24 * 60 * MIN);
  let best = null;
  for (let k = 0; k < n; k++) {
    const idx = (nextIndex + k) % n;
    const d = designers[idx];
    const slots = generateSlots(earliest, farLimit, bookedByDesigner.get(d.id) || new Set(), hours);
    if (slots.length && (!best || slots[0] < best.slot)) best = { designer: d, slot: slots[0], idx };
  }
  if (!best) return null;
  return { designer: best.designer, slot: best.slot, windowMissed: true, skipped, nextIndex: (best.idx + 1) % n };
}
