// Front desk covers 10am-7pm IST. The case does not state working days;
// Mon-Sat is an assumption, change WORKING_DAYS if the studio differs.
const TZ = "Asia/Kolkata";
const OPEN_HOUR = 10;
const CLOSE_HOUR = 19;
const WORKING_DAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "numeric",
  weekday: "short",
  hourCycle: "h23",
});

function istHourAndDay(d: Date) {
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return { hour: Number(parts.hour), day: parts.weekday as string };
}

export function isWorkingTime(d: Date): boolean {
  const { hour, day } = istHourAndDay(d);
  return WORKING_DAYS.has(day) && hour >= OPEN_HOUR && hour < CLOSE_HOUR;
}

export const isAfterHours = (d: Date) => !isWorkingTime(d);

/** Working minutes elapsed between two instants (5-minute resolution). */
export function workingMinutesBetween(from: Date, to: Date): number {
  const STEP = 5;
  let minutes = 0;
  for (let t = from.getTime(); t < to.getTime(); t += STEP * 60_000) {
    if (isWorkingTime(new Date(t))) minutes += STEP;
  }
  return minutes;
}
