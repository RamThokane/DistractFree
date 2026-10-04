const test = require('node:test');
const assert = require('node:assert/strict');
const logreg = require('../ml/logisticRegressionModel');
const tree = require('../ml/decisionTreeModel');
const activeModel = require('../ml/activeModel');
const { buildFeatures, buildTrainingRows } = require('../ml/featureBuilder');
const { MODEL_INPUT_NAMES, toModelInputs } = require('../ml/modelInputs');
const { CSV_COLUMNS, toCsv } = require('../ml/extractTrainingData');
const { explainContributions, describeContributions, bestCounterfactual } = require('../ml/explain');
const { predictFromHistory, toClientPrediction, toLegacyTopFeatures } = require('../services/predictionService');
const { TZ, success, failure, tinyTree, tinyLogreg, features } = require('./helpers');

const model = tinyLogreg();
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !== ${b}`);

// ── Inference ──────────────────────────────────────

test('probability is sigmoid(intercept + Σ coef · (x − mean) / std), computed by hand', () => {
  const f = features({ successRateLast5: 0.8, plannedDuration: 45, hourOfDay: 18, isWeekend: 1 });
  // hour 18 → angle 3π/2 → sin = −1, cos ≈ 0
  const z = -0.1
    + 1.2 * ((0.8 - 0.4) / 0.2)
    + -0.5 * ((45 - 30) / 10)
    + 0.3 * ((-1 - 0) / 0.7)
    + -0.4 * ((Math.cos(3 * Math.PI / 2) - 0) / 0.7)
    + 0.2 * ((1 - 0.3) / 0.45);
  const result = logreg.predict(f, model);
  close(result.probability, 1 / (1 + Math.exp(-z)));
  close(result.logit, z);
  assert.equal(result.predictedClass, z > 0 ? 1 : 0);
  assert.equal(result.label, z > 0 ? 'successful' : 'not_successful');
});

test('contributions are coef · scaled value and add up with the intercept to the logit', () => {
  const result = logreg.predict(features(), model);
  assert.deepEqual(result.contributions.map((c) => c.feature), model.featureNames);
  for (const c of result.contributions) close(c.contribution, c.coefficient * c.scaled, 1e-12);
  close(result.contributions.reduce((s, c) => s + c.contribution, model.intercept), result.logit, 1e-12);
});

test('a decision value of exactly 0 is the negative class, as in scikit-learn', () => {
  const zero = tinyLogreg({ featureNames: ['isWeekend'], means: [0], stds: [1], coefficients: [1], intercept: 0 });
  const result = logreg.predict(features({ isWeekend: 0 }), zero);
  assert.equal(result.probability, 0.5);
  assert.equal(result.predictedClass, 0);
});

test('invalid or mismatched model files are rejected', () => {
  assert.equal(logreg.isCompatible(model), true);
  assert.equal(logreg.isCompatible(null), false);
  assert.equal(logreg.isCompatible(tinyLogreg({ featureNames: ['focusScore', 'plannedDuration', 'hourSin', 'hourCos', 'isWeekend'] })), false);
  assert.equal(logreg.isCompatible(tinyLogreg({ coefficients: [1, 2] })), false);
  assert.equal(logreg.isCompatible(tinyLogreg({ stds: [0.2, 0, 0.7, 0.7, 0.45] })), false);
  assert.equal(logreg.isCompatible(tinyLogreg({ intercept: null })), false);
  assert.equal(logreg.isCompatible(tinyTree()), false);
  assert.throws(() => logreg.predict(features(), null), /No trained model/);
});

test('importances are |coefficient| shares, highest first', () => {
  const importances = logreg.computeFeatureImportances(model);
  assert.equal(importances[0].feature, 'successRateLast5');
  close(importances.reduce((s, i) => s + i.importance, 0), 1, 1e-3);
});

// ── One transform for training and inference ───────

const history = [
  success('2026-02-26T04:30:00Z'),
  failure('2026-02-27T16:30:00Z', { distractionAttempts: 4, tabSwitches: 10 }),
  success('2026-02-28T04:30:00Z', { tabSwitches: 2 }),
  success('2026-03-01T18:30:00Z'),
  failure('2026-03-02T03:30:00Z', { status: 'completed', duration: 10, distractionAttempts: 1 }),
];

test('extraction (CSV) and inference produce identical model inputs and scaled vectors', () => {
  // Extraction path, exactly as extractTrainingData.js writes it, read back from the CSV text
  const rows = buildTrainingRows(history).map(toModelInputs);
  const [header, ...lines] = toCsv(rows).trim().split('\n');
  assert.deepEqual(header.split(','), CSV_COLUMNS);
  const fromCsv = lines.map((line) => Object.fromEntries(header.split(',').map((c, i) => [c, line.split(',')[i]])));

  rows.forEach((row, i) => {
    // Inference path for the same session
    const session = history.find((s) => s.startTime.toISOString() === row.startTime);
    const { features: live } = buildFeatures({ sessions: history, startTime: session.startTime, plannedDuration: session.plannedDuration, timezone: TZ });
    const liveInputs = toModelInputs(live);

    const csvVector = MODEL_INPUT_NAMES.map((name) => Number(fromCsv[i][name]));
    const liveVector = MODEL_INPUT_NAMES.map((name) => liveInputs[name]);
    assert.deepEqual(csvVector, liveVector);

    const scaledFromCsv = logreg.predict(Object.fromEntries(MODEL_INPUT_NAMES.map((n, k) => [n, csvVector[k]])), model).contributions.map((c) => c.scaled);
    const scaledLive = logreg.predict(live, model).contributions.map((c) => c.scaled);
    assert.deepEqual(scaledFromCsv, scaledLive);
  });
});

test('the hour is encoded on a circle: 23:00 is next to 00:00', () => {
  const at = (h) => toModelInputs(features({ hourOfDay: h }));
  const dist = (a, b) => Math.hypot(a.hourSin - b.hourSin, a.hourCos - b.hourCos);
  close(dist(at(23), at(0)), dist(at(0), at(1)), 1e-12);
  assert.ok(dist(at(23), at(0)) < dist(at(0), at(12)));
});

// ── Explanations ───────────────────────────────────

test('reasons come from contributions, in the shape the UI expects, with the hour merged into one reason', () => {
  const f = features({ successRateLast5: 0.8, plannedDuration: 60, hourOfDay: 22 });
  const prediction = logreg.predict(f, model);
  const reasons = explainContributions(prediction, f);

  assert.deepEqual(reasons.map((r) => r.feature).sort(), ['hourOfDay', 'isWeekend', 'plannedDuration', 'successRateLast5']);
  for (const r of reasons) assert.deepEqual(Object.keys(r), ['feature', 'label', 'value', 'condition', 'effect', 'delta', 'text']);

  const byFeature = Object.fromEntries(reasons.map((r) => [r.feature, r]));
  assert.equal(byFeature.successRateLast5.effect, 'raises');
  assert.equal(byFeature.successRateLast5.text, 'Your success rate over the last 5 sessions is 80% (above average) → higher chance');
  assert.equal(byFeature.plannedDuration.effect, 'lowers');
  assert.equal(byFeature.hourOfDay.condition, null);
  assert.equal(byFeature.isWeekend.condition, null);

  // Strongest first; delta = change against the same session with this input at the average
  for (let i = 1; i < reasons.length; i += 1) assert.ok(Math.abs(reasons[i - 1].delta) >= Math.abs(reasons[i].delta));
  const rate = prediction.contributions.find((c) => c.feature === 'successRateLast5').contribution;
  close(byFeature.successRateLast5.delta, Math.round((prediction.probability - logreg.sigmoid(prediction.logit - rate)) * 1000) / 1000, 1e-12);

  const steps = describeContributions(prediction, f);
  assert.deepEqual(steps.map((s) => s.feature), reasons.map((r) => r.feature));
  assert.equal(steps[0].node, 0);
});

test('the counterfactual works with the logistic regression', () => {
  const f = features({ plannedDuration: 60, hourOfDay: 22 });
  const context = { bandRates: {}, overallRate: 0.4, typicalHours: [] };
  const result = bestCounterfactual(f, context, model);
  // Shorter plans have a negative-coefficient feature lower, so 25 min is best
  assert.equal(result.plannedDuration, 25);
});

// ── Prediction service and model selection ─────────

const request = { sessions: history, startTime: new Date('2026-03-02T05:30:00Z'), plannedDuration: 25, timezone: TZ };

test('with a logistic regression the API response keeps its shape', () => {
  const result = predictFromHistory({ ...request, model });
  assert.equal(result.status, 'ready');
  assert.equal(result.source, 'model');
  assert.equal(result.modelVersion, 'lr-test');
  assert.equal(result.leafSamples, null);
  assert.ok(result.reasons.length > 0);
  assert.equal(result.path.length, result.reasons.length);
  assert.match(result.explanation, /^A 25-minute session started now has a \d+% chance of going to plan\./);
  assert.doesNotMatch(result.explanation, /model|regression|tree|trained/i);

  const client = toClientPrediction(result);
  assert.equal(client.modelInfo.kind, 'logreg');
  assert.equal(client.inputFeatures.length, 13);
  close(client.successProbability, logreg.predict(result.features, model).probability, 1e-12);
  assert.deepEqual(Object.keys(toLegacyTopFeatures(result.reasons)[0]), ['feature', 'value', 'impact', 'explanation']);
});

test('the minimum-data guard applies to the logistic regression too', () => {
  const result = predictFromHistory({ ...request, model: tinyLogreg({ nReal: 49 }) });
  assert.equal(result.status, 'learning');
  assert.equal(result.source, 'baseline');
});

function withEnv(value, fn) {
  const before = process.env.ML_MODEL;
  if (value === undefined) delete process.env.ML_MODEL;
  else process.env.ML_MODEL = value;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.ML_MODEL;
    else process.env.ML_MODEL = before;
  }
}

/** Run fn with stand-in loaded models. */
function withLoaded({ lr, dt }, fn) {
  const [lrGet, dtGet] = [logreg.getModel, tree.getModel];
  logreg.getModel = () => lr;
  tree.getModel = () => dt;
  try {
    return fn();
  } finally {
    logreg.getModel = lrGet;
    tree.getModel = dtGet;
  }
}

test('ML_MODEL selects the model; logreg is the default', () => {
  const lr = tinyLogreg();
  const dt = tinyTree();
  withLoaded({ lr, dt }, () => {
    assert.equal(withEnv(undefined, () => activeModel.getActiveModel()), lr);
    assert.equal(withEnv('logreg', () => activeModel.getActiveModel()), lr);
    assert.equal(withEnv('tree', () => activeModel.getActiveModel()), dt);
    assert.equal(withEnv('nonsense', () => activeModel.requestedKind()), 'logreg');
  });
});

test('ML_MODEL=tree still runs the old decision-tree path end to end', () => {
  withLoaded({ lr: tinyLogreg(), dt: tinyTree() }, () => withEnv('tree', () => {
    const result = predictFromHistory(request);
    assert.equal(result.modelVersion, 'dt-test');
    assert.equal(result.modelInfo.kind, 'tree');
    // successRateLast5 = 0.6 > 0.55 → leaf 2: (5 + 1) / (7 + 2)
    close(result.successProbability, 6 / 9, 1e-12);
    assert.equal(result.leafSamples, 7);
    assert.equal(result.path[0].threshold, 0.55);
    assert.equal(result.reasons[0].feature, 'successRateLast5');
  }));
});

test('a missing or invalid logistic regression falls back to the tree, then to the baseline', () => {
  withLoaded({ lr: null, dt: tinyTree() }, () => withEnv('logreg', () => {
    assert.equal(activeModel.getModelState().kind, 'tree');
    assert.equal(predictFromHistory(request).modelVersion, 'dt-test');
  }));
  withLoaded({ lr: null, dt: null }, () => withEnv('logreg', () => {
    const result = predictFromHistory(request);
    assert.equal(result.source, 'baseline');
    assert.equal(result.status, 'learning');
  }));
});
