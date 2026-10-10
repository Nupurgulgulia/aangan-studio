const IST_OFFSET_MS = 330 * 60 * 1000;
const MIN = 60 * 1000;

export const SLOT_MINUTES = 30;

// Studio hours in IST minutes from midnight, by weekday (0 = Sunday). null = closed.
export const DEFAULT_HOURS = {
  0: null,
  1: [10 * 60, 19 * 60],
  2: [10 * 60, 19 * 60],
  3: [10 * 60, 19 * 60],
  4: [10 * 60, 19 * 60],
  5: [10 * 60, 19 * 60],
  6: [10 * 60, 19 * 60],
};

export function toIST(date) {
  const d = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

export function fromIST(year, month, day, minutes) {
  return new Date(Date.UTC(year, month, day, 0, minutes) - IST_OFFSET_MS);
}

export function startOfISTDay(date) {
  const t = toIST(date);
  return fromIST(t.year, t.month, t.day, 0);
}

export function addDays(date, n) {
  return new Date(date.getTime() + n * 24 * 60 * MIN);
}

export function windowFor(date, hours = DEFAULT_HOURS) {
  const t = toIST(date);
  const h = hours[t.weekday];
  if (!h) return null;
  return {
    start: fromIST(t.year, t.month, t.day, h[0]),
    end: fromIST(t.year, t.month, t.day, h[1]),
  };
}

// Moves `hoursToAdd` of open studio time forward from `from`.
export function addWorkingHours(from, hoursToAdd, hours = DEFAULT_HOURS) {
  let remaining = hoursToAdd * 60 * MIN;
  let cursor = new Date(from.getTime());
  for (let i = 0; i < 21; i++) {
    const w = windowFor(cursor, hours);
    if (w) {
      if (cursor < w.start) cursor = new Date(w.start.getTime());
      if (cursor < w.end) {
        const available = w.end.getTime() - cursor.getTime();
        if (remaining <= available) return new Date(cursor.getTime() + remaining);
        remaining -= available;
      }
    }
    cursor = addDays(startOfISTDay(cursor), 1);
  }
  return cursor;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Spoken form, for example "Thursday at 11:30 AM". Adds "today" or "tomorrow" when relevant.
export function speakSlot(slot, now) {
  const t = toIST(slot);
  const n = toIST(now);
  const h24 = Math.floor(t.minutes / 60);
  const m = t.minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const clock = `${h12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h24 < 12 ? 'AM' : 'PM'}`;
  const sameDay = t.year === n.year && t.month === n.month && t.day === n.day;
  const tomorrowIST = toIST(addDays(now, 1));
  const isTomorrow = t.year === tomorrowIST.year && t.month === tomorrowIST.month && t.day === tomorrowIST.day;
  const day = sameDay ? 'today' : isTomorrow ? 'tomorrow' : WEEKDAYS[t.weekday];
  return `${day} at ${clock}`;
}
