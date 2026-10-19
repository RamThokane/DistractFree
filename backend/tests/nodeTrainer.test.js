const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { fit, trainOnRows, rocAuc, FEATURES } = require('../ml/nodeTrainer');

const CSV = path.join(__dirname, '..', 'ml', 'data', 'training_data.csv');
const PY_MODEL = path.join(__dirname, '..', 'ml', 'model', 'logistic_regression_model.json');

function readCsv() {
  const [header, ...lines] = fs.readFileSync(CSV, 'utf8').trim().split(/\r?\n/);
  const cols = header.split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])));
}

test('Node fit matches the scikit-learn model on the same data and C', () => {
  const py = JSON.parse(fs.readFileSync(PY_MODEL, 'utf8'));
  const rows = readCsv();
  const X = rows.map((r) => FEATURES.map((f) => Number(r[f])));
  const y = rows.map((r) => Number(r.sessionSuccess));
  const m = fit(X, y, py.C);
  FEATURES.forEach((f, i) => {
    const j = py.featureNames.indexOf(f);
    assert.ok(Math.abs(m.coefficients[i] - py.coefficients[j]) < 1e-4, `${f}: ${m.coefficients[i]} vs ${py.coefficients[j]}`);
    assert.ok(Math.abs(m.means[i] - py.means[j]) < 1e-6);
  });
  assert.ok(Math.abs(m.intercept - py.intercept) < 1e-4);
});

test('learns a real signal and validates it walk-forward', () => {
  // Success depends on streak and recent success; 120 sessions in time order
  const rows = [];
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 120; i++) {
    const streak = Math.floor(rnd() * 8);
    const last5 = rnd();
    const z = -2 + 0.5 * streak + 2 * last5;
    rows.push({
      startTime: new Date(Date.UTC(2026, 0, 1) + i * 3600e3).toISOString(),
      userKey: `u${i % 4}`,
      successRateLast5: last5, plannedDuration: 25, currentStreak: streak,
      hourBandSuccessRate: 0.5, avgDistractionsLast5: 1, isWeekend: 0,
      sessionSuccess: rnd() < 1 / (1 + Math.exp(-z)) ? 1 : 0,
    });
  }
  const r = trainOnRows(rows);
  assert.equal(r.trained, true);
  assert.ok(r.model.coefficients[FEATURES.indexOf('currentStreak')] > 0);
  assert.ok(r.model.metrics.walkForward.roc_auc > 0.65, r.model.metrics.walkForward.roc_auc);
  assert.equal(r.model.nUsers, 4);
});

test('refuses to train on too little data', () => {
  const r = trainOnRows([{ startTime: '2026-01-01', sessionSuccess: 1, currentStreak: 1 }]);
  assert.equal(r.trained, false);
  assert.match(r.reason, /needs/);
});

test('ROC-AUC: perfect, inverted, and ties', () => {
  assert.equal(rocAuc([0, 0, 1, 1], [0.1, 0.2, 0.8, 0.9]), 1);
  assert.equal(rocAuc([0, 0, 1, 1], [0.9, 0.8, 0.2, 0.1]), 0);
  assert.equal(rocAuc([0, 1], [0.5, 0.5]), 0.5);
  assert.equal(rocAuc([1, 1], [0.2, 0.3]), null);
});
