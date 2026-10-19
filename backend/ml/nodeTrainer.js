/**
 * Node trainer — the model learns from every session, on the server.
 *
 * When a session ends, the backend retrains the logistic regression on ALL
 * real finished sessions from all users (the same rows and inputs as the
 * Python pipeline: featureBuilder.buildTrainingRows + modelInputs), checks it
 * honestly, and stores it in MongoDB (models/MlModel.js). activeModel picks
 * the newest stored model up on every instance within a minute.
 *
 * Why Node: Vercel can't run the Python trainer or write model files, so the
 * old auto-retrain never ran in production. Six inputs and a few thousand
 * rows train in milliseconds here.
 *
 * Fit: L2-regularised logistic regression on standardised inputs, solved with
 * Newton's method (IRLS); objective = Σ wᵢ·log-loss + ||w||² / (2C), intercept
 * unpenalised, with balanced class weights wᵢ = n / (2·n_class) — the same as
 * the Python trainer's LogisticRegression(penalty='l2', class_weight='balanced').
 *
 * Checks (real sessions only, in time order):
 *   - C chosen by expanding-window validation on the oldest 80%
 *   - holdout: train on the oldest 80%, score the newest 20%
 *   - walk-forward: each block of sessions predicted by a model trained only
 *     on the sessions before it — the number the app trusts (ROC-AUC ≥ 0.6)
 */

const FocusSession = require('../models/FocusSession');
const MlModel = require('../models/MlModel');
const { ENDED_STATUSES } = require('./target');
const { buildTrainingRows } = require('./featureBuilder');
const { toModelInputs } = require('./modelInputs');

// Same inputs the Python trainer selected for the production model
const FEATURES = Object.freeze([
  'successRateLast5',
  'plannedDuration',
  'currentStreak',
  'hourBandSuccessRate',
  'avgDistractionsLast5',
  'isWeekend',
]);
const C_GRID = [0.01, 0.1, 1, 10];
const MIN_ROWS = 30;          // below this, nothing is trained
const KEEP_MODELS = 20;       // older stored models are pruned
const MAX_SESSIONS = 5000;    // newest sessions used, so ending a session stays fast as data grows
const MIN_TRAIN_FOR_EVAL = 20;

// ── maths ─────────────────────────────────────────
const sigmoid = (z) => 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, z))));

function standardiser(X) {
  const d = X[0].length;
  const means = Array(d).fill(0);
  const stds = Array(d).fill(0);
  for (const x of X) for (let j = 0; j < d; j++) means[j] += x[j] / X.length;
  for (const x of X) for (let j = 0; j < d; j++) stds[j] += (x[j] - means[j]) ** 2 / X.length;
  for (let j = 0; j < d; j++) stds[j] = Math.sqrt(stds[j]) || 1;
  return { means, stds, apply: (x) => x.map((v, j) => (v - means[j]) / stds[j]) };
}

/** Solve A·x = b (small dense system) with Gaussian elimination + partial pivoting. */
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c] || 1e-12;
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / piv;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / (M[r][r] || 1e-12);
  }
  return x;
}

/**
 * Fit on raw rows (arrays in FEATURES order) and labels (0/1).
 * @returns {{ means, stds, coefficients, intercept, C }}
 */
function fit(X, y, C) {
  const sc = standardiser(X);
  const Z = X.map(sc.apply);
  const d = Z[0].length;
  let w = Array(d + 1).fill(0); // [intercept, ...coefficients]
  const lambda = 1 / C;
  // Balanced class weights, so the rarer outcome counts as much as the common one
  const nPos = y.reduce((a, v) => a + v, 0);
  const cw = { 1: y.length / (2 * Math.max(1, nPos)), 0: y.length / (2 * Math.max(1, y.length - nPos)) };
  for (let iter = 0; iter < 50; iter++) {
    const g = Array(d + 1).fill(0);
    const H = Array.from({ length: d + 1 }, () => Array(d + 1).fill(0));
    for (let i = 0; i < Z.length; i++) {
      const xi = [1, ...Z[i]];
      const p = sigmoid(xi.reduce((s, v, j) => s + v * w[j], 0));
      const r = cw[y[i]] * (p - y[i]);
      const s = cw[y[i]] * p * (1 - p);
      for (let a = 0; a <= d; a++) {
        g[a] += r * xi[a];
        for (let b = 0; b <= d; b++) H[a][b] += s * xi[a] * xi[b];
      }
    }
    for (let a = 1; a <= d; a++) { g[a] += lambda * w[a]; H[a][a] += lambda; }
    H[0][0] += 1e-9;
    const step = solve(H, g);
    w = w.map((v, j) => v - step[j]);
    if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  return { means: sc.means, stds: sc.stds, intercept: w[0], coefficients: w.slice(1), C };
}

const predictRaw = (m, x) => sigmoid(m.intercept + x.reduce((s, v, j) => s + m.coefficients[j] * ((v - m.means[j]) / m.stds[j]), 0));

/** ROC-AUC by ranks (ties averaged); null when only one class is present. */
function rocAuc(y, p) {
  const pos = y.filter((v) => v === 1).length;
  const neg = y.length - pos;
  if (!pos || !neg) return null;
  const order = p.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const ranks = Array(p.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    for (let k = i; k <= j; k++) ranks[order[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  const sumPos = y.reduce((s, v, i) => s + (v === 1 ? ranks[i] : 0), 0);
  return (sumPos - (pos * (pos + 1)) / 2) / (pos * neg);
}

function scores(y, p) {
  if (!y.length) return null;
  const eps = 1e-12;
  const correct = y.filter((v, i) => (p[i] >= 0.5 ? 1 : 0) === v).length;
  const r4 = (v) => (v === null ? null : Math.round(v * 10000) / 10000);
  return {
    n: y.length,
    accuracy: r4(correct / y.length),
    roc_auc: r4(rocAuc(y, p)),
    log_loss: r4(-y.reduce((s, v, i) => s + (v ? Math.log(p[i] + eps) : Math.log(1 - p[i] + eps)), 0) / y.length),
    brier: r4(y.reduce((s, v, i) => s + (p[i] - v) ** 2, 0) / y.length),
    success_rate: r4(y.reduce((s, v) => s + v, 0) / y.length),
  };
}

/** Expanding-window predictions: each block scored by a model fit on everything before it. */
function walkForward(X, y, C, blocks = 8) {
  const start = Math.max(MIN_TRAIN_FOR_EVAL, Math.floor(X.length * 0.4));
  if (X.length - start < 5) return null;
  const size = Math.max(1, Math.ceil((X.length - start) / blocks));
  const yy = [];
  const pp = [];
  for (let s = start; s < X.length; s += size) {
    const trainY = y.slice(0, s);
    if (!trainY.includes(0) || !trainY.includes(1)) continue;
    const m = fit(X.slice(0, s), trainY, C);
    for (let i = s; i < Math.min(X.length, s + size); i++) { yy.push(y[i]); pp.push(predictRaw(m, X[i])); }
  }
  return scores(yy, pp);
}

function chooseC(X, y) {
  let best = { C: 1, loss: Infinity };
  for (const C of C_GRID) {
    const wf = walkForward(X, y, C, 5);
    if (wf && wf.log_loss < best.loss) best = { C, loss: wf.log_loss };
  }
  return best.C;
}

/** Pure training + evaluation on prepared rows (no database). */
function trainOnRows(rows) {
  const sorted = [...rows].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const X = sorted.map((r) => FEATURES.map((f) => Number(r[f]) || 0));
  const y = sorted.map((r) => (r.sessionSuccess === 1 ? 1 : 0));
  if (X.length < MIN_ROWS || !y.includes(0) || !y.includes(1)) {
    return { trained: false, reason: X.length < MIN_ROWS ? `needs ${MIN_ROWS} finished sessions, has ${X.length}` : 'all sessions have the same outcome', n: X.length };
  }

  const cut = Math.floor(X.length * 0.8);
  const C = chooseC(X.slice(0, cut), y.slice(0, cut));
  const holdModel = fit(X.slice(0, cut), y.slice(0, cut), C);
  const holdout = scores(y.slice(cut), X.slice(cut).map((x) => predictRaw(holdModel, x)));
  const walk = walkForward(X, y, C);
  const final = fit(X, y, C);
  const positives = y.reduce((s, v) => s + v, 0);

  return {
    trained: true,
    model: {
      kind: 'logistic_regression',
      featureNames: [...FEATURES],
      ...final,
      nReal: X.length,
      nSamples: X.length,
      nUsers: new Set(sorted.map((r) => r.userKey)).size,
      classBalance: { successful: positives, not_successful: X.length - positives },
      metrics: { holdout, walkForward: walk, trainedOn: { from: sorted[0].startTime, to: sorted[sorted.length - 1].startTime } },
    },
  };
}

let running = null;

/**
 * Retrain on every real finished session and store the result.
 * Concurrent calls share one run. Never throws.
 * @returns {Promise<{ trained: boolean, version?: string, reason?: string, metrics?: object }>}
 */
function retrainFromAllSessions({ trigger = 'session_end' } = {}) {
  if (running) return running;
  running = (async () => {
    const t0 = Date.now();
    try {
      const sessions = await FocusSession.find({ status: { $in: ENDED_STATUSES }, source: { $ne: 'simulated' } })
        .sort({ startTime: -1 })
        .limit(MAX_SESSIONS)
        .select('userId startTime endTime plannedDuration duration status distractionAttempts tabSwitches timezone source')
        .lean();
      const rows = buildTrainingRows(sessions).map(toModelInputs).filter((r) => r.source === 'real');
      const result = trainOnRows(rows);
      if (!result.trained) return { trained: false, reason: result.reason };

      const trainedAt = new Date();
      const version = `lr-node-${trainedAt.toISOString().replace(/\D/g, '').slice(0, 14)}`;
      await MlModel.create({ ...result.model, version, trainedAt, trigger, trainingMs: Date.now() - t0 });

      // Keep the newest KEEP_MODELS
      const old = await MlModel.find().sort({ trainedAt: -1 }).skip(KEEP_MODELS).select('_id').lean();
      if (old.length) await MlModel.deleteMany({ _id: { $in: old.map((o) => o._id) } });

      console.log(`[ML] Retrained ${version} on ${result.model.nReal} sessions in ${Date.now() - t0} ms — walk-forward AUC ${result.model.metrics.walkForward?.roc_auc ?? 'n/a'}`);
      return { trained: true, version, metrics: result.model.metrics, nReal: result.model.nReal };
    } catch (err) {
      console.error('[ML] Node retrain failed:', err.message);
      return { trained: false, reason: err.message };
    } finally {
      running = null;
    }
  })();
  return running;
}

module.exports = { FEATURES, trainOnRows, retrainFromAllSessions, fit, rocAuc, scores };
