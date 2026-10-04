const test = require('node:test');
const assert = require('node:assert/strict');
const { getModelState, MIN_REAL_SESSIONS } = require('../ml/decisionTreeModel');
const { predictFromHistory, riskFromProbability, toClientPrediction, toLegacyTopFeatures } = require('../services/predictionService');
const { liveFocusStatus } = require('../utils/liveFocusStatus');
const { TZ, success, failure, tinyTree } = require('./helpers');

const history = [
  success('2026-02-26T04:30:00Z'),
  failure('2026-02-27T16:30:00Z'),
  success('2026-02-28T04:30:00Z'),
  success('2026-03-01T04:30:00Z'),
];
const request = { sessions: history, startTime: new Date('2026-03-02T05:30:00Z'), plannedDuration: 25, timezone: TZ };

test('the guard threshold is 50 real sessions', () => {
  assert.equal(MIN_REAL_SESSIONS, 50);
});

test('no model, or a model trained on too little real data, is not ready', () => {
  assert.deepEqual(
    [getModelState(null).ready, getModelState(null).reason],
    [false, 'no_model']
  );
  const small = getModelState(tinyTree({ n_real: 49 }));
  assert.equal(small.ready, false);
  assert.equal(small.reason, 'insufficient_data');
  assert.equal(small.nReal, 49);
  assert.equal(small.minRequired, 50);

  assert.equal(getModelState(tinyTree({ n_real: 50 })).ready, true);
});

test('simulated sessions do not count towards the guard', () => {
  const state = getModelState(tinyTree({ n_real: 10, n_simulated: 5000 }));
  assert.equal(state.ready, false);
});

test('below the threshold the API reports "still learning" plus the plain baseline', () => {
  for (const model of [null, tinyTree({ n_real: 12 })]) {
    const result = predictFromHistory({ ...request, model });
    assert.equal(result.status, 'learning');
    assert.equal(result.source, 'baseline');
    assert.equal(result.successProbability, 0.75); // 3 of the user's 4 sessions succeeded
    assert.deepEqual(result.baseline, { successRate: 0.75, sessions: 4 });
    assert.equal(result.predictedSuccess, true);
    assert.deepEqual(result.reasons, []); // no tree was consulted, so no tree reasons
    assert.equal(result.counterfactual, null);
    assert.match(result.message, /still learning your focus habits/);
  }
});

test('still learning and no history: no number is invented', () => {
  const result = predictFromHistory({ ...request, sessions: [], model: null });
  assert.equal(result.status, 'learning');
  assert.equal(result.successProbability, null);
  assert.equal(result.predictedSuccess, null);
  assert.equal(result.riskLevel, null);
  assert.equal(toClientPrediction(result).successPercent, null);
});

test('with enough real data the tree is used and explained', () => {
  const result = predictFromHistory({ ...request, model: tinyTree({ n_real: 60 }) });
  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'model');
  assert.equal(result.modelVersion, 'dt-test');
  // successRateLast5 = 0.75 > 0.55 → leaf 2: (5 + 1) / (7 + 2)
  assert.ok(Math.abs(result.successProbability - 6 / 9) < 1e-12);
  assert.equal(result.predictedSuccess, true);
  assert.equal(result.riskLevel, 'low');
  assert.equal(result.reasons.length, 1);
  assert.equal(result.message, null);

  const client = toClientPrediction(result);
  assert.equal(client.successPercent, 67);
  assert.equal(client.features, undefined);

  const [legacy] = toLegacyTopFeatures(result.reasons);
  assert.deepEqual(Object.keys(legacy), ['feature', 'value', 'impact', 'explanation']);
  assert.equal(legacy.impact, 'positive');
});

test('success probability maps onto the legacy risk levels', () => {
  assert.equal(riskFromProbability(0.9), 'low');
  assert.equal(riskFromProbability(0.65), 'low');
  assert.equal(riskFromProbability(0.5), 'medium');
  assert.equal(riskFromProbability(0.4), 'medium');
  assert.equal(riskFromProbability(0.39), 'high');
  assert.equal(riskFromProbability(null), null);
});

test('the live in-session status is a simple rule over session counts', () => {
  assert.equal(liveFocusStatus({}), 'low');
  assert.equal(liveFocusStatus({ tabSwitches: 6, blockAttempts: 2 }), 'medium');
  assert.equal(liveFocusStatus({ tabSwitches: 12, blockAttempts: 5, interruptions: 4 }), 'high');
});

// ── Client payload ─────────────────────────────────

const { storedSessionPrediction } = require('../services/predictionService');

test('the client payload carries probabilities, confidence, source, inputs and the path', () => {
  const client = toClientPrediction(predictFromHistory({ ...request, model: tinyTree({ n_real: 60 }) }));
  assert.equal(client.source, 'model');
  assert.ok(Math.abs(client.classProbabilities.successful - 6 / 9) < 1e-12);
  assert.ok(Math.abs(client.classProbabilities.not_successful - 3 / 9) < 1e-12);
  assert.ok(Math.abs(client.confidence - 6 / 9) < 1e-12);
  assert.equal(client.inputFeatures.length, 13);
  assert.equal(client.path.length, 1);
  assert.equal(client.isColdStart, false);
  assert.equal(client.modelInfo.version, 'dt-test');
});

test('a user with no sessions still gets a prediction, flagged as cold start', () => {
  const client = toClientPrediction(predictFromHistory({ ...request, sessions: [], model: tinyTree({ n_real: 60 }) }));
  assert.equal(client.isColdStart, true);
  assert.equal(client.source, 'model');
  assert.notEqual(client.successPercent, null);
  assert.equal(client.inputFeatures.find((i) => i.feature === 'hasHistory').value, 0);
});

test('the stored start-of-session prediction is returned during the session', () => {
  assert.equal(storedSessionPrediction({ predictedSuccessProb: null }), null);
  const live = storedSessionPrediction({
    predictedSuccessProb: 0.3, predictionSource: 'model', modelVersion: 'dt-test', predictionReasons: ['first', 'second'],
  });
  assert.equal(live.successPercent, 30);
  assert.equal(live.riskLevel, 'high');
  assert.equal(live.topReason, 'first');
  assert.ok(Math.abs(live.confidence - 0.7) < 1e-12);
});
