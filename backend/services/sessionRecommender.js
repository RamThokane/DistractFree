/**
 * Smart session recommender — "when should I focus next, and for how long?"
 *
 * Scores every candidate session (each full hour in the next 24 hours ×
 * 25/40/60/90/120 minutes) and returns the best one, e.g.
 *   "Start a 40-min session at 5 PM: 78% chance it goes to plan".
 *
 * Two scorers, chosen honestly:
 *   - 'model'   — the trained success model (logistic regression / tree),
 *                 used only once it has proven itself on sessions it was not
 *                 trained on (walk-forward ROC-AUC ≥ MODEL_MIN_AUC).
 *   - 'history' — the user's own outcomes: how often sessions at that hour and
 *                 of that length went to plan, each shrunk towards the user's
 *                 overall rate so a single lucky session can't dominate.
 *                 Same success rule as the model (ml/target.js).
 * A weak model scores every option within a few points of each other, so
 * ranking with it would pick noise; the history scorer is used until then.
 */

const FocusSession = require('../models/FocusSession');
const { ENDED_STATUSES, isSessionSuccess } = require('../ml/target');
const { HOUR_BANDS, isValidTimezone, DEFAULT_TIMEZONE } = require('../ml/featureBuilder');
const { localParts, zonedTimeToUtc, localDayNumber, dayFromNumber } = require('../utils/timezone');

const LENGTHS = Object.freeze([25, 40, 60, 90, 120]);
const MIN_SESSIONS = 8;        // fewer ended sessions than this → no recommendation yet
const MIN_LENGTH_SAMPLES = 2;  // a length is only "best" once tried at least twice
const PRIOR_WEIGHT = 8;        // pseudo-sessions pulling small samples towards the parent rate
// Hour and length effects aren't independent; adding both in full overstates
// the odds (3 good 6 PM sessions + good 40-min sessions ≠ 93%). Damp the sum.
const EFFECT_DAMPING = 0.75;
const EARLIEST_HOUR = 6;       // candidate starts between 6:00 and 22:00 local
const LATEST_HOUR = 22;
const SOON_HOURS = 3;
const MODEL_MIN_AUC = 0.6;
const HISTORY_LIMIT = 300;

const bandOf = (hour) => HOUR_BANDS.find((b) => hour >= b.from && hour <= b.to) || HOUR_BANDS[0];
const nearestLength = (minutes) => LENGTHS.reduce((a, b) => (Math.abs(b - minutes) < Math.abs(a - minutes) ? b : a));
const clamp = (p) => Math.min(0.95, Math.max(0.05, p));
const logit = (p) => Math.log(clamp(p) / (1 - clamp(p)));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const shrink = (successes, n, prior) => (successes + PRIOR_WEIGHT * prior) / (n + PRIOR_WEIGHT);

function hourLabel(hour) {
  const h = hour % 12 || 12;
  return `${h} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** Success counts per local hour, per band, per length bucket, and overall. */
function tally(sessions, tz) {
  const t = { n: 0, s: 0, hour: {}, band: {}, length: {} };
  const bump = (obj, key, y) => { obj[key] ||= { n: 0, s: 0 }; obj[key].n += 1; obj[key].s += y; };
  for (const session of sessions) {
    const y = isSessionSuccess(session);
    const { hour } = localParts(session.startTime, session.timezone && isValidTimezone(session.timezone) ? session.timezone : tz);
    t.n += 1;
    t.s += y;
    bump(t.hour, hour, y);
    bump(t.band, bandOf(hour).name, y);
    bump(t.length, nearestLength(Number(session.plannedDuration) || 25), y);
  }
  return t;
}

/** History scorer: hour and length effects combined on the log-odds scale. */
function historyScorer(t) {
  const overall = (t.s + 1) / (t.n + 2);
  return ({ hour, plannedDuration }) => {
    const band = t.band[bandOf(hour).name] || { n: 0, s: 0 };
    const bandRate = shrink(band.s, band.n, overall);
    const h = t.hour[hour] || { n: 0, s: 0 };
    const hourRate = shrink(h.s, h.n, bandRate);
    const l = t.length[plannedDuration] || { n: 0, s: 0 };
    const lengthRate = shrink(l.s, l.n, overall);
    const p = sigmoid(logit(overall) + EFFECT_DAMPING * ((logit(hourRate) - logit(overall)) + (logit(lengthRate) - logit(overall))));
    return {
      probability: clamp(p),
      evidence: { hour: { ...h, rate: hourRate }, band: { name: bandOf(hour).label, ...band, rate: bandRate }, length: { ...l, rate: lengthRate }, overall },
    };
  };
}

/** Candidate start instants: now, then every full hour in the next 24 hours (6:00–22:00 local). */
function candidateStarts(now, tz) {
  const starts = [{ at: now, isNow: true }];
  const today = localDayNumber(now, tz);
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const d = dayFromNumber(today + dayOffset);
    for (let hour = EARLIEST_HOUR; hour <= LATEST_HOUR; hour++) {
      const at = zonedTimeToUtc({ year: d.year, month: d.month, day: d.day, hour, minute: 0 }, tz);
      const ahead = at.getTime() - now.getTime();
      if (ahead > 10 * 60000 && ahead <= 24 * 3600000) starts.push({ at, isNow: false });
    }
  }
  return starts;
}

/** Fits before local midnight (no recommendation that runs into the next day). */
function fitsInDay(at, minutes, tz) {
  const p = localParts(at, tz);
  return p.hour * 60 + p.minute + minutes <= 24 * 60;
}

/**
 * Pure core (no database).
 * @param {object}   input
 * @param {object[]} input.sessions     ended sessions (any order)
 * @param {Date}     input.now
 * @param {string}   input.timezone
 * @param {Function} [input.modelScore] ({ startTime, plannedDuration }) → probability; used when given
 */
function recommendFromHistory({ sessions, now = new Date(), timezone, modelScore = null }) {
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const ended = sessions.filter((s) => ENDED_STATUSES.includes(s.status));
  if (ended.length < MIN_SESSIONS) {
    return {
      status: 'learning',
      basedOn: ended.length,
      needed: MIN_SESSIONS,
      message: `Finish ${MIN_SESSIONS - ended.length} more session${MIN_SESSIONS - ended.length === 1 ? '' : 's'} and we'll suggest the best time and length for you.`,
    };
  }

  const t = tally(ended, tz);
  const fromHistory = historyScorer(t);
  const source = modelScore ? 'model' : 'history';

  const options = [];
  for (const start of candidateStarts(now, tz)) {
    const { hour } = localParts(start.at, tz);
    for (const plannedDuration of LENGTHS) {
      if (!fitsInDay(start.at, plannedDuration, tz)) continue;
      const hist = fromHistory({ hour, plannedDuration });
      const probability = modelScore ? clamp(modelScore({ startTime: start.at, plannedDuration })) : hist.probability;
      options.push({
        startAt: start.at,
        isNow: start.isNow,
        hour,
        plannedDuration,
        probability,
        tried: (t.length[plannedDuration]?.n || 0) >= MIN_LENGTH_SAMPLES,
        evidence: hist.evidence,
      });
    }
  }

  // Best = highest chance among lengths the user has actually tried; within a
  // point, the sooner option wins (a plan you can start is worth more).
  const rank = (a, b) => (Math.abs(b.probability - a.probability) > 0.01 ? b.probability - a.probability : a.startAt - b.startAt);
  const eligible = options.filter((o) => o.tried);
  const pool = eligible.length ? eligible : options;
  const sorted = [...pool].sort(rank);
  const best = sorted[0];

  const soonCutoff = now.getTime() + SOON_HOURS * 3600000;
  const soonest = [...pool].filter((o) => o.startAt.getTime() <= soonCutoff).sort(rank)[0] || null;

  // A different length at the best time, for people who want more (or less)
  const otherLength = [...pool]
    .filter((o) => o.startAt.getTime() === best.startAt.getTime() && o.plannedDuration !== best.plannedDuration)
    .sort(rank)[0] || null;

  const describe = (o) => o && ({
    startAt: o.startAt.toISOString(),
    isNow: o.isNow,
    isToday: localDayNumber(o.startAt, tz) === localDayNumber(now, tz),
    timeLabel: o.isNow ? 'now' : hourLabel(o.hour),
    plannedDuration: o.plannedDuration,
    successPercent: Math.round(o.probability * 100),
    headline: o.isNow
      ? `Start a ${o.plannedDuration}-min session now`
      : `Start a ${o.plannedDuration}-min session at ${hourLabel(o.hour)}${localDayNumber(o.startAt, tz) === localDayNumber(now, tz) ? '' : ' tomorrow'}`,
  });

  const e = best.evidence;
  const why = [];
  if (e.hour.n > 0) why.push(`${Math.round((e.hour.s / e.hour.n) * 100)}% of your sessions around ${hourLabel(best.hour)} went to plan (${e.hour.n} session${e.hour.n === 1 ? '' : 's'})`);
  else if (e.band.n > 0) why.push(`${Math.round((e.band.s / e.band.n) * 100)}% of your ${e.band.name} sessions went to plan (${e.band.n})`);
  if (e.length.n > 0) why.push(`${Math.round((e.length.s / e.length.n) * 100)}% of your ${best.plannedDuration}-min sessions went to plan (${e.length.n})`);
  why.push(`Your overall rate is ${Math.round(e.overall * 100)}%`);

  const spread = sorted.length ? Math.round((sorted[0].probability - sorted[sorted.length - 1].probability) * 100) : 0;

  return {
    status: 'ready',
    source,
    timezone: tz,
    basedOn: ended.length,
    best: describe(best),
    soonest: soonest && (soonest.startAt.getTime() !== best.startAt.getTime() || soonest.plannedDuration !== best.plannedDuration) ? describe(soonest) : null,
    otherLength: describe(otherLength),
    why,
    spread,
    optionsScored: options.length,
  };
}

/**
 * Recommendation for a user. Uses the model only if it validated well on
 * unseen sessions; otherwise the user's own history.
 */
/** True once the trained model has validated on sessions it wasn't trained on. */
function modelIsReliable() {
  try {
    // Lazy require keeps this module usable in unit tests without the model files
    const { getTrainingReport } = require('../ml/trainModel');
    const auc = getTrainingReport()?.walk_forward?.model?.roc_auc;
    return typeof auc === 'number' && auc >= MODEL_MIN_AUC;
  } catch {
    return false;
  }
}

async function loadHistory(userId, timezone) {
  const sessions = await FocusSession.find({ userId, status: { $in: ENDED_STATUSES } })
    .sort({ startTime: -1 })
    .limit(HISTORY_LIMIT)
    .select('startTime endTime plannedDuration duration status distractionAttempts tabSwitches timezone')
    .lean();
  const tz = isValidTimezone(timezone)
    ? timezone
    : sessions.find((s) => isValidTimezone(s.timezone))?.timezone || DEFAULT_TIMEZONE;
  return { sessions, tz };
}

async function recommendForUser(userId, { timezone, now = new Date() } = {}) {
  const { sessions, tz } = await loadHistory(userId, timezone);

  let modelScore = null;
  try {
    const { predictFromHistory } = require('./predictionService');
    if (modelIsReliable()) {
      modelScore = ({ startTime, plannedDuration }) => {
        const p = predictFromHistory({ sessions, startTime, plannedDuration, timezone: tz });
        return p.source === 'model' ? p.successProbability : null;
      };
      // Model not ready for this user (minimum-data guard) → history instead
      if (modelScore({ startTime: now, plannedDuration: 25 }) == null) modelScore = null;
    }
  } catch (err) {
    console.error('[Recommender] Model check failed, using history:', err.message);
    modelScore = null;
  }

  return recommendFromHistory({ sessions, now, timezone: tz, modelScore });
}

/**
 * The forecast for one session ("start N minutes now"), shown on the
 * dashboard and AI Insights. Uses the same scorer as the recommender, so the
 * two never disagree: the model once it is reliable, otherwise the user's
 * history. Session-start predictions stored for training stay model-only
 * (focusSessionService → predictForUser).
 */
async function forecastForUser(userId, { startTime = new Date(), plannedDuration, timezone } = {}) {
  const { predictForUser, riskFromProbability } = require('./predictionService');
  const prediction = await predictForUser(userId, { startTime, plannedDuration, timezone });
  if (modelIsReliable()) return prediction;

  const { sessions, tz } = await loadHistory(userId, prediction.timezone || timezone);
  if (sessions.length < MIN_SESSIONS) return prediction; // too little history: keep the existing answer

  const length = nearestLength(prediction.plannedDuration);
  const { hour } = localParts(startTime, tz);
  const est = historyScorer(tally(sessions, tz))({ hour, plannedDuration: length });
  const p = est.probability;
  const e = est.evidence;
  const reason = (feature, label, rate, n, text) => ({
    feature,
    label,
    value: `${Math.round(rate * 100)}%`,
    condition: rate > e.overall ? 'above average' : rate < e.overall ? 'below average' : null,
    effect: rate > e.overall + 0.01 ? 'raises' : rate < e.overall - 0.01 ? 'lowers' : 'neutral',
    delta: Math.round((rate - e.overall) * 1000) / 1000,
    text,
    samples: n,
  });
  const hourRate = e.hour.n ? e.hour.s / e.hour.n : null;
  const lengthRate = e.length.n ? e.length.s / e.length.n : null;
  const reasons = [
    hourRate !== null && reason('hourOfDay', 'This time of day', hourRate, e.hour.n,
      `${Math.round(hourRate * 100)}% of your sessions around ${hourLabel(hour)} went to plan (${e.hour.n})`),
    lengthRate !== null && reason('plannedDuration', 'Planned length', lengthRate, e.length.n,
      `${Math.round(lengthRate * 100)}% of your ${length}-min sessions went to plan (${e.length.n})`),
  ].filter(Boolean);

  return {
    ...prediction,
    status: 'ready',
    source: 'history',
    plannedDuration: length,
    successProbability: p,
    predictedSuccess: p >= 0.5,
    riskLevel: riskFromProbability(p),
    reasons,
    path: [],
    counterfactual: null,
    message: null,
    explanation: `A ${length}-minute session started now has a ${Math.round(p * 100)}% chance of going to plan, based on how your past sessions went.`,
    modelProbability: prediction.source === 'model' ? prediction.successProbability : null,
  };
}

module.exports = { LENGTHS, MIN_SESSIONS, MODEL_MIN_AUC, recommendFromHistory, recommendForUser, forecastForUser, modelIsReliable, candidateStarts };
