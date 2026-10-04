/**
 * Timezone helpers built on the Intl API (no extra dependency).
 *
 * Scheduled sessions repeat at a local wall-clock time ("every Monday at
 * 9:00 in Asia/Kolkata"), so occurrences must be computed in the user's
 * timezone, including across DST changes.
 */

const { isValidTimezone } = require('../ml/featureBuilder');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatters = new Map();

const zoneOr = (tz, fallback = 'UTC') => (isValidTimezone(tz) ? tz : fallback);

function formatterFor(tz) {
  if (!formatters.has(tz)) {
    formatters.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    }));
  }
  return formatters.get(tz);
}

/**
 * Wall-clock parts of an instant in a timezone.
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number, weekday: number }}
 *   month is 1–12, weekday is 0 (Sun) – 6 (Sat)
 */
function localParts(date, tz) {
  const parts = {};
  for (const p of formatterFor(zoneOr(tz)).formatToParts(new Date(date))) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday],
  };
}

/** Offset of `tz` from UTC at `date`, in ms (positive east of Greenwich). */
function offsetMs(date, tz) {
  const p = localParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(new Date(date).getTime() / 1000) * 1000;
}

/**
 * The instant at which the wall clock in `tz` reads the given local time.
 * A time skipped by a DST jump resolves to the instant just after the gap.
 */
function zonedTimeToUtc({ year, month, day, hour, minute }, tz) {
  const zone = zoneOr(tz);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = offsetMs(new Date(guess), zone);
  let t = guess - first;
  const second = offsetMs(new Date(t), zone);
  if (second !== first) t = guess - second;
  return new Date(t);
}

/** Days since the epoch of the local calendar date of `date` in `tz`. */
function localDayNumber(date, tz) {
  const p = localParts(date, tz);
  return Date.UTC(p.year, p.month - 1, p.day) / DAY_MS;
}

/** { year, month, day, weekday } of a day number. */
function dayFromNumber(n) {
  const d = new Date(n * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay() };
}

module.exports = { DAY_MS, zoneOr, localParts, offsetMs, zonedTimeToUtc, localDayNumber, dayFromNumber, isValidTimezone };
