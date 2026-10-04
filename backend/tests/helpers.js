const { FEATURE_NAMES } = require('../ml/featureBuilder');

const TZ = 'Asia/Kolkata';
const MINUTE = 60 * 1000;

/** A finished session. `start` is an ISO string in UTC. */
function session(start, overrides = {}) {
  const startTime = new Date(start);
  const plannedDuration = overrides.plannedDuration ?? 25;
  const duration = overrides.duration ?? plannedDuration;
  return {
    userId: 'user-a',
    startTime,
    endTime: new Date(startTime.getTime() + Math.max(duration, 1) * MINUTE),
    plannedDuration,
    duration,
    status: 'completed',
    distractionAttempts: 0,
    tabSwitches: 0,
    timezone: TZ,
    source: 'real',
    ...overrides,
  };
}

const success = (start, overrides) => session(start, overrides);
const failure = (start, overrides) => session(start, { status: 'cancelled', duration: 5, ...overrides });

/**
 * A small hand-built tree in the exported JSON format:
 *
 *   0: successRateLast5 <= 0.55 ?
 *        yes → 1: hourOfDay <= 20.5 ?
 *                   yes → 3 (leaf)   no → 4 (leaf)
 *        no  → 2 (leaf)
 */
function tinyTree(overrides = {}) {
  return {
    model_version: 'dt-test',
    trained_at: '2026-01-01T00:00:00+00:00',
    n_real: 60,
    feature_names: [...FEATURE_NAMES],
    class_names: ['not_successful', 'successful'],
    n_nodes: 5,
    children_left: [1, 3, -1, -1, -1],
    children_right: [2, 4, -1, -1, -1],
    feature: [FEATURE_NAMES.indexOf('successRateLast5'), FEATURE_NAMES.indexOf('hourOfDay'), -2, -2, -2],
    threshold: [0.55, 20.5, -2, -2, -2],
    // [failures, successes]
    value: [[12, 8], [10, 3], [2, 5], [4, 3], [6, 0]],
    node_class: [0, 0, 1, 1, 0],
    ...overrides,
  };
}

/** A complete feature object; override what a test cares about. */
function features(overrides = {}) {
  return {
    hourOfDay: 10,
    dayOfWeek: 2,
    isWeekend: 0,
    plannedDuration: 25,
    successRateLast5: 0.4,
    successRateLast20: 0.4,
    avgDistractionsLast5: 1,
    avgTabSwitchesLast5: 3,
    currentStreak: 2,
    minutesSinceLastSession: 120,
    sessionsAlreadyToday: 1,
    hourBandSuccessRate: 0.5,
    hasHistory: 1,
    ...overrides,
  };
}

/**
 * A small hand-built logistic regression in the exported JSON format.
 * Uses the hour transform, so hourSin/hourCos are exercised.
 */
function tinyLogreg(overrides = {}) {
  return {
    kind: 'logistic_regression',
    version: 'lr-test',
    trainedAt: '2026-01-01T00:00:00+00:00',
    featureNames: ['successRateLast5', 'plannedDuration', 'hourSin', 'hourCos', 'isWeekend'],
    means: [0.4, 30, 0, 0, 0.3],
    stds: [0.2, 10, 0.7, 0.7, 0.45],
    coefficients: [1.2, -0.5, 0.3, -0.4, 0.2],
    intercept: -0.1,
    C: 1,
    nSamples: 60,
    nReal: 60,
    nSimulated: 0,
    classBalance: { not_successful: 35, successful: 25 },
    ...overrides,
  };
}

module.exports = { TZ, session, success, failure, tinyTree, tinyLogreg, features };
