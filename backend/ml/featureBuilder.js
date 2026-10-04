/**
 * Shared feature builder — the ONLY place model features are computed.
 *
 * Both training extraction (extractTrainingData.js) and live inference
 * (services/predictionService.js) call buildFeatures(), so the two can never
 * drift apart.
 *
 * Every feature is known BEFORE the session starts:
 *   - when it starts (hour, weekday) and how long the user plans to focus
 *   - the same user's own history, strictly earlier than this start time
 *
 * Nothing measured during the session being predicted (its duration, tab
 * switches, distraction attempts, status) is ever read here.
 *
 * This module is pure: no database access, no clock reads.
 */

const { isSessionSuccess, hasEnded } = require('./target');

// Order matters: it is the column order of the training CSV and of the vector
// the exported tree indexes into.
const FEATURE_NAMES = Object.freeze([
  'hourOfDay',
  'dayOfWeek',
  'isWeekend',
  'plannedDuration',
  'successRateLast5',
  'successRateLast20',
  'avgDistractionsLast5',
  'avgTabSwitchesLast5',
  'currentStreak',
  'minutesSinceLastSession',
  'sessionsAlreadyToday',
  'hourBandSuccessRate',
  'hasHistory',
]);

// Only the most recent sessions are read, in training and at inference alike,
// so a long-time user gets exactly the features the model was trained on.
const HISTORY_WINDOW = 200;
const MINUTES_SINCE_LAST_CAP = 1440;

// Values used when a user has no earlier sessions. These are fixed neutral
// priors rather than means computed from the dataset: a data-derived mean
// would need future sessions to compute. `hasHistory` tells the tree when
// these placeholders are in play.
const NO_HISTORY_DEFAULTS = Object.freeze({
  successRate: 0.5,
  avgDistractions: 0,
  avgTabSwitches: 0,
  minutesSinceLastSession: MINUTES_SINCE_LAST_CAP,
});

// Sessions recorded before the timezone field existed fall back to this.
const DEFAULT_TIMEZONE = process.env.ML_DEFAULT_TIMEZONE || 'Asia/Kolkata';

const HOUR_BANDS = Object.freeze([
  { name: 'night', label: 'night (12–6 AM)', from: 0, to: 5 },
  { name: 'morning', label: 'morning (6 AM–12 PM)', from: 6, to: 11 },
  { name: 'afternoon', label: 'afternoon (12–5 PM)', from: 12, to: 16 },
  { name: 'evening', label: 'evening (5–9 PM)', from: 17, to: 20 },
  { name: 'late', label: 'late evening (9 PM–12 AM)', from: 21, to: 23 },
]);

const bandOfHour = (hour) => HOUR_BANDS.find((b) => hour >= b.from && hour <= b.to) || HOUR_BANDS[0];

// ── Local time ─────────────────────────────────────
const formatters = new Map();
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function isValidTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function formatterFor(tz) {
  if (!formatters.has(tz)) {
    formatters.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      weekday: 'short',
    }));
  }
  return formatters.get(tz);
}

/**
 * Wall-clock parts of an instant in a timezone.
 * @returns {{ hour: number, dayOfWeek: number, dayNumber: number }} dayNumber = days since epoch of the local date
 */
function localParts(date, tz) {
  const zone = isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
  const parts = {};
  for (const p of formatterFor(zone).formatToParts(new Date(date))) parts[p.type] = p.value;
  return {
    hour: Number(parts.hour) % 24,
    dayOfWeek: WEEKDAYS[parts.weekday],
    dayNumber: Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86400000,
  };
}

// ── History ────────────────────────────────────────
const time = (d) => new Date(d).getTime();
const round4 = (x) => Math.round(x * 10000) / 10000;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * The user's sessions that were already over when a session starting at
 * `startTime` begins: outcome known, started strictly earlier, and not still
 * running. Oldest first, capped to HISTORY_WINDOW.
 */
function priorSessions(sessions, startTime) {
  const t = time(startTime);
  return (sessions || [])
    .filter((s) => hasEnded(s) && time(s.startTime) < t && (!s.endTime || time(s.endTime) <= t))
    .sort((a, b) => time(a.startTime) - time(b.startTime))
    .slice(-HISTORY_WINDOW);
}

/** Consecutive local days with a completed session, ending today or yesterday. */
function streakAt(completedDays, today) {
  let day = completedDays.has(today) ? today : today - 1;
  let streak = 0;
  while (completedDays.has(day)) {
    streak += 1;
    day -= 1;
  }
  return streak;
}

/**
 * Build the pre-session feature set for one session.
 *
 * @param {object}   input
 * @param {object[]} input.sessions        the user's sessions (any order; later ones are ignored)
 * @param {Date}     input.startTime       when the session being predicted starts
 * @param {number}   input.plannedDuration minutes the user plans to focus
 * @param {string}  [input.timezone]       IANA timezone of the user
 * @returns {{ features: object, context: object }}
 *   features — one value per FEATURE_NAMES entry
 *   context  — history summaries needed for counterfactuals and the baseline
 */
function buildFeatures({ sessions, startTime, plannedDuration, timezone }) {
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const now = localParts(startTime, tz);
  const prior = priorSessions(sessions, startTime);
  const hasHistory = prior.length > 0;

  const outcomes = prior.map(isSessionSuccess);
  const local = prior.map((s) => localParts(s.startTime, s.timezone || tz));
  const rateOf = (xs) => (xs.length ? round4(mean(xs)) : null);

  const last5 = prior.slice(-5);
  const overallRate = rateOf(outcomes);

  // Success rate per hour band, and how often the user starts at each hour
  const bandOutcomes = {};
  const hourCounts = {};
  local.forEach((p, i) => {
    (bandOutcomes[bandOfHour(p.hour).name] ||= []).push(outcomes[i]);
    hourCounts[p.hour] = (hourCounts[p.hour] || 0) + 1;
  });
  const bandRates = Object.fromEntries(HOUR_BANDS.map((b) => [b.name, rateOf(bandOutcomes[b.name] || [])]));
  const typicalHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
    .map(([h]) => Number(h));

  const completedDays = new Set(local.filter((_, i) => prior[i].status === 'completed').map((p) => p.dayNumber));
  const last = prior[prior.length - 1];
  const minutesSinceLast = hasHistory
    ? Math.max(0, Math.min(MINUTES_SINCE_LAST_CAP, Math.round((time(startTime) - time(last.endTime || last.startTime)) / 60000)))
    : NO_HISTORY_DEFAULTS.minutesSinceLastSession;

  const context = { bandRates, overallRate, typicalHours, historyCount: prior.length, timezone: tz };

  const features = {
    hourOfDay: now.hour,
    dayOfWeek: now.dayOfWeek,
    isWeekend: now.dayOfWeek === 0 || now.dayOfWeek === 6 ? 1 : 0,
    plannedDuration: Number(plannedDuration),
    successRateLast5: rateOf(outcomes.slice(-5)) ?? NO_HISTORY_DEFAULTS.successRate,
    successRateLast20: rateOf(outcomes.slice(-20)) ?? NO_HISTORY_DEFAULTS.successRate,
    avgDistractionsLast5: hasHistory
      ? round4(mean(last5.map((s) => s.distractionAttempts || 0)))
      : NO_HISTORY_DEFAULTS.avgDistractions,
    avgTabSwitchesLast5: hasHistory
      ? round4(mean(last5.map((s) => s.tabSwitches || 0)))
      : NO_HISTORY_DEFAULTS.avgTabSwitches,
    currentStreak: streakAt(completedDays, now.dayNumber),
    minutesSinceLastSession: minutesSinceLast,
    sessionsAlreadyToday: local.filter((p) => p.dayNumber === now.dayNumber).length,
    hourBandSuccessRate: hourBandRate(context, now.hour),
    hasHistory: hasHistory ? 1 : 0,
  };

  return { features, context };
}

/** The user's past success rate in the band containing `hour`, falling back to their overall rate. */
function hourBandRate(context, hour) {
  return context.bandRates[bandOfHour(hour).name] ?? context.overallRate ?? NO_HISTORY_DEFAULTS.successRate;
}

/**
 * Features as they would be if the user changed something they control.
 * Only the start hour and the planned duration can be changed; everything
 * else (including time since the last session) is held as it is.
 */
function applyControllable(features, context, { hourOfDay, plannedDuration } = {}) {
  const next = { ...features };
  if (hourOfDay !== undefined) {
    next.hourOfDay = hourOfDay;
    next.hourBandSuccessRate = hourBandRate(context, hourOfDay);
  }
  if (plannedDuration !== undefined) next.plannedDuration = plannedDuration;
  return next;
}

const toVector = (features) => FEATURE_NAMES.map((name) => Number(features[name]));

/**
 * Turn raw sessions (all users) into labelled training rows, oldest first.
 * Each row's features come only from that user's earlier sessions.
 *
 * @param {object[]} sessions FocusSession documents (lean)
 * @returns {object[]} rows: { userKey, startTime, source, ...features, sessionSuccess }
 */
function buildTrainingRows(sessions) {
  const byUser = new Map();
  for (const s of sessions) {
    const key = String(s.userId);
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key).push(s);
  }

  const rows = [];
  let userIndex = 0;
  for (const userSessions of byUser.values()) {
    userIndex += 1;
    userSessions.sort((a, b) => time(a.startTime) - time(b.startTime));
    // Legacy sessions have no timezone; borrow the user's most recent known one
    const userTz = [...userSessions].reverse().find((s) => isValidTimezone(s.timezone))?.timezone;

    userSessions.forEach((session) => {
      if (!hasEnded(session)) return;
      // The whole list is passed, exactly as at inference; buildFeatures keeps
      // only what came before this session's start.
      const { features } = buildFeatures({
        sessions: userSessions,
        startTime: session.startTime,
        plannedDuration: session.plannedDuration,
        timezone: session.timezone || userTz,
      });
      rows.push({
        userKey: `u${userIndex}`,
        startTime: new Date(session.startTime).toISOString(),
        source: session.source === 'simulated' ? 'simulated' : 'real',
        ...features,
        sessionSuccess: isSessionSuccess(session),
      });
    });
  }

  return rows.sort((a, b) => time(a.startTime) - time(b.startTime));
}

module.exports = {
  FEATURE_NAMES,
  HISTORY_WINDOW,
  MINUTES_SINCE_LAST_CAP,
  NO_HISTORY_DEFAULTS,
  DEFAULT_TIMEZONE,
  HOUR_BANDS,
  bandOfHour,
  isValidTimezone,
  localParts,
  priorSessions,
  buildFeatures,
  applyControllable,
  toVector,
  buildTrainingRows,
};
