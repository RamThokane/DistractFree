const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FEATURE_NAMES,
  NO_HISTORY_DEFAULTS,
  buildFeatures,
  buildTrainingRows,
  applyControllable,
  toVector,
  localParts,
} = require('../ml/featureBuilder');
const { simulateSessions } = require('../ml/seedSimulatedUsers');
const { TZ, session, success, failure } = require('./helpers');

// 2026-03-02 is a Monday. 04:30 UTC = 10:00 in Asia/Kolkata.
const history = [
  success('2026-02-26T04:30:00Z'), // Thu 10:00
  failure('2026-02-27T16:30:00Z', { distractionAttempts: 4, tabSwitches: 10 }), // Fri 22:00
  success('2026-02-28T04:30:00Z', { tabSwitches: 2 }), // Sat 10:00
  success('2026-03-01T04:30:00Z'), // Sun 10:00
  failure('2026-03-02T03:30:00Z', { status: 'completed', duration: 10, distractionAttempts: 1 }), // Mon 09:00, ended early
];
const current = { startTime: new Date('2026-03-02T05:30:00Z'), plannedDuration: 45, timezone: TZ }; // Mon 11:00

test('features are exactly the documented pre-session set', () => {
  const { features } = buildFeatures({ sessions: history, ...current });
  assert.deepEqual(Object.keys(features), [...FEATURE_NAMES]);
  assert.equal(toVector(features).length, FEATURE_NAMES.length);
  assert.ok(toVector(features).every(Number.isFinite));
});

test('features are computed from history as specified', () => {
  const { features } = buildFeatures({ sessions: history, ...current });
  assert.equal(features.hourOfDay, 11);
  assert.equal(features.dayOfWeek, 1);
  assert.equal(features.isWeekend, 0);
  assert.equal(features.plannedDuration, 45);
  assert.equal(features.successRateLast5, 0.6);
  assert.equal(features.successRateLast20, 0.6);
  assert.equal(features.avgDistractionsLast5, 1); // (0+4+0+0+1)/5
  assert.equal(features.avgTabSwitchesLast5, 2.4); // (0+10+2+0+0)/5
  assert.equal(features.currentStreak, 3); // Sat, Sun, Mon completed; Fri was cancelled
  assert.equal(features.minutesSinceLastSession, 110); // last one ended 03:40, now 05:30
  assert.equal(features.sessionsAlreadyToday, 1);
  assert.equal(features.hourBandSuccessRate, 0.75); // morning: 3 of 4
  assert.equal(features.hasHistory, 1);
});

test('local time follows the timezone, not the server clock', () => {
  const instant = new Date('2026-03-01T20:00:00Z');
  assert.deepEqual(
    [localParts(instant, 'Asia/Kolkata').hour, localParts(instant, 'Asia/Kolkata').dayOfWeek],
    [1, 1] // 01:30 Monday
  );
  assert.deepEqual([localParts(instant, 'UTC').hour, localParts(instant, 'UTC').dayOfWeek], [20, 0]);
});

test('a first session gets neutral defaults and hasHistory = 0', () => {
  const { features, context } = buildFeatures({ sessions: [], ...current });
  assert.equal(features.hasHistory, 0);
  assert.equal(features.successRateLast5, NO_HISTORY_DEFAULTS.successRate);
  assert.equal(features.successRateLast20, NO_HISTORY_DEFAULTS.successRate);
  assert.equal(features.hourBandSuccessRate, NO_HISTORY_DEFAULTS.successRate);
  assert.equal(features.minutesSinceLastSession, NO_HISTORY_DEFAULTS.minutesSinceLastSession);
  assert.equal(features.currentStreak, 0);
  assert.equal(features.sessionsAlreadyToday, 0);
  assert.equal(context.overallRate, null);
});

test('minutes since the last session is capped', () => {
  const { features } = buildFeatures({ sessions: [success('2026-01-01T04:30:00Z')], ...current });
  assert.equal(features.minutesSinceLastSession, 1440);
});

// ── No future leakage ──────────────────────────────

test('sessions at or after the start time never affect the features', () => {
  const before = buildFeatures({ sessions: history, ...current }).features;
  const future = [
    failure('2026-03-02T05:30:00Z', { distractionAttempts: 9, tabSwitches: 50 }), // same instant
    failure('2026-03-02T06:00:00Z', { distractionAttempts: 9, tabSwitches: 50 }),
    success('2026-03-03T04:30:00Z'),
    success('2026-04-01T04:30:00Z'),
  ];
  assert.deepEqual(buildFeatures({ sessions: [...future, ...history], ...current }).features, before);
});

test("the predicted session's own outcome never affects its features", () => {
  const asSuccess = success(current.startTime.toISOString(), { plannedDuration: 45 });
  const asFailure = failure(current.startTime.toISOString(), { plannedDuration: 45, distractionAttempts: 7, tabSwitches: 30 });
  assert.deepEqual(
    buildFeatures({ sessions: [...history, asSuccess], ...current }).features,
    buildFeatures({ sessions: [...history, asFailure], ...current }).features
  );
});

test('sessions still running at the start time are not counted as history', () => {
  const before = buildFeatures({ sessions: history, ...current }).features;
  const stillActive = session('2026-03-02T05:00:00Z', { status: 'active', endTime: null });
  const endsLater = success('2026-03-02T05:00:00Z', { plannedDuration: 120 }); // ends 07:00, after 05:30
  assert.deepEqual(buildFeatures({ sessions: [...history, stillActive, endsLater], ...current }).features, before);
});

test('training rows: changing a later session leaves every earlier row unchanged', () => {
  const sessions = [...history, success(current.startTime.toISOString(), { plannedDuration: 45 })];
  const rows = buildTrainingRows(sessions);
  assert.equal(rows.length, 6);

  // Flip the outcome of session 3 (index 2) and make it as bad as possible
  const altered = sessions.map((s, i) => (i === 2 ? failure(s.startTime.toISOString(), { distractionAttempts: 9, tabSwitches: 99 }) : s));
  const alteredRows = buildTrainingRows(altered);

  const featuresOf = (row) => FEATURE_NAMES.map((name) => row[name]);
  for (let i = 0; i <= 2; i++) {
    assert.deepEqual(featuresOf(alteredRows[i]), featuresOf(rows[i]), `row ${i} must not see session 3's outcome`);
  }
  assert.notDeepEqual(featuresOf(alteredRows[3]), featuresOf(rows[3]));
  assert.equal(rows[2].sessionSuccess, 1);
  assert.equal(alteredRows[2].sessionSuccess, 0);
});

test('training rows: features match what live inference would have computed', () => {
  const sessions = [...history, success(current.startTime.toISOString(), { plannedDuration: 45 })];
  const lastRow = buildTrainingRows(sessions).at(-1);
  const live = buildFeatures({ sessions: history, ...current }).features;
  assert.deepEqual(FEATURE_NAMES.map((n) => lastRow[n]), toVector(live));
});

test("training rows: users never see each other's history, and active sessions are skipped", () => {
  const other = [
    failure('2026-02-20T04:30:00Z', { userId: 'user-b' }),
    session('2026-03-05T04:30:00Z', { userId: 'user-b', status: 'active' }),
  ];
  const rows = buildTrainingRows([...history, ...other]);
  assert.equal(rows.length, 6);
  const firstOfA = rows.find((r) => r.startTime === '2026-02-26T04:30:00.000Z');
  assert.equal(firstOfA.hasHistory, 0);
  assert.ok(rows.every((r, i) => i === 0 || r.startTime >= rows[i - 1].startTime), 'rows are oldest first');
});

// ── Counterfactual inputs ──────────────────────────

test('changing the start hour also updates the hour-band success rate', () => {
  const { features, context } = buildFeatures({ sessions: history, ...current });
  const late = applyControllable(features, context, { hourOfDay: 22 });
  assert.equal(late.hourOfDay, 22);
  assert.equal(late.hourBandSuccessRate, 0); // the only late-evening session failed
  assert.equal(late.successRateLast5, features.successRateLast5);

  const shorter = applyControllable(features, context, { plannedDuration: 25 });
  assert.equal(shorter.plannedDuration, 25);
  assert.equal(shorter.hourOfDay, features.hourOfDay);
});

// ── Simulated data ─────────────────────────────────

test('the simulator writes raw sessions only, marked as simulated', () => {
  let n = 0;
  const options = { days: 20, seed: 3, endDate: new Date('2026-03-01T00:00:00Z'), newUserId: () => `sim-${(n += 1)}` };
  const sessions = simulateSessions(options);
  assert.ok(sessions.length > 30);
  assert.ok(sessions.every((s) => s.source === 'simulated'));
  assert.ok(sessions.every((s) => ['completed', 'cancelled'].includes(s.status)));
  // No model feature or label is ever written by the simulator
  const written = new Set(sessions.flatMap(Object.keys));
  for (const name of [...FEATURE_NAMES, 'sessionSuccess']) {
    if (name !== 'plannedDuration') assert.equal(written.has(name), false, `${name} must not be simulated directly`);
  }
  // Both outcomes occur, and the label is derived by the shared target rule
  const rows = buildTrainingRows(sessions);
  assert.ok(rows.every((r) => r.source === 'simulated'));
  assert.ok(rows.some((r) => r.sessionSuccess === 1) && rows.some((r) => r.sessionSuccess === 0));

  n = 0;
  assert.deepEqual(simulateSessions(options), sessions, 'same seed, same sessions');
});
