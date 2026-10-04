/**
 * Decision Tree Model — Node.js inference for the tree trained in Python.
 *
 * train_model.py fits a scikit-learn DecisionTreeClassifier and exports it as
 * JSON (parallel arrays, one entry per node). This module loads that file and
 * walks the tree. It is the fallback model (ML_MODEL=tree, or when the logistic
 * regression is missing — see activeModel.js). When no usable model exists
 * the caller is told so (see getModelState) and reports a plain baseline.
 *
 * JSON schema (per node i):
 *   children_left[i] / children_right[i]  child indices (−1 = leaf)
 *   feature[i]                            index into feature_names
 *   threshold[i]                          go left when value <= threshold
 *   value[i]                              [failures, successes] — raw training counts
 *   node_class[i]                         class scikit-learn predicts at this node
 */

const fs = require('fs');
const path = require('path');
const { FEATURE_NAMES, toVector } = require('./featureBuilder');

const MODEL_PATH = path.resolve(__dirname, 'model', 'decision_tree_model.json');
const CLASS_NAMES = ['not_successful', 'successful'];

// Below this many real sessions the model is not trusted and is not used.
const MIN_REAL_SESSIONS = 50;

let treeModel = null;

/** A model is usable only if it was trained on exactly the features we compute. */
function isCompatible(model) {
  return Boolean(
    model &&
    Array.isArray(model.feature_names) &&
    model.feature_names.length === FEATURE_NAMES.length &&
    model.feature_names.every((name, i) => name === FEATURE_NAMES[i]) &&
    Array.isArray(model.children_left) &&
    Array.isArray(model.value)
  );
}

/** Load the exported tree from disk. Returns true when a compatible model is in memory. */
function loadModel() {
  treeModel = null;
  try {
    if (!fs.existsSync(MODEL_PATH)) {
      console.warn('[ML] No trained model at', MODEL_PATH, "— active source: baseline (each user's past success rate)");
      return false;
    }
    const model = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf-8'));
    if (!isCompatible(model)) {
      console.warn('[ML] Model file does not match the current feature set — retrain with `npm run ml:retrain`');
      return false;
    }
    treeModel = model;
    const usable = getModelState(model).ready ? 'usable' : 'not used (too little real data)';
    console.log(`[ML] Decision tree ${model.model_version} loaded (${model.n_nodes} nodes, ${model.n_real} real sessions available at training) — ${usable}`);
    return true;
  } catch (err) {
    console.error('[ML] Failed to load model:', err.message);
    return false;
  }
}

const getModel = () => treeModel;

/**
 * Minimum-data guard.
 *
 * @param {object|null} [model] defaults to the loaded model
 * @returns {{ ready: boolean, reason: string|null, nReal: number, minRequired: number, modelVersion: string|null, trainedAt: string|null }}
 */
function getModelState(model = treeModel) {
  const nReal = model?.n_real || 0;
  let reason = null;
  if (!model) reason = 'no_model';
  else if (nReal < MIN_REAL_SESSIONS) reason = 'insufficient_data';
  return {
    ready: reason === null,
    reason,
    nReal,
    minRequired: MIN_REAL_SESSIONS,
    modelVersion: model?.model_version || null,
    trainedAt: model?.trained_at || null,
  };
}

/** Version and size of a model, for display. Null when there is no model. */
function getModelInfo(model = treeModel) {
  if (!model) return null;
  return {
    version: model.model_version || null,
    trainedAt: model.trained_at || null,
    nodes: model.n_nodes,
    depth: model.max_depth,
  };
}

/**
 * Feature importances computed from the exported tree alone: each split's
 * drop in Gini impurity, weighted by how many training sessions reached it,
 * summed per feature and normalised to 1. Uses the raw (unweighted) counts in
 * the JSON, so values can differ slightly from scikit-learn's class-weighted
 * importances in training_report.json.
 *
 * @returns {{ feature: string, importance: number }[]} highest first
 */
function computeFeatureImportances(model = treeModel) {
  if (!model) return [];
  const gini = ([fail, success]) => {
    const n = fail + success;
    return n === 0 ? 0 : 1 - (fail / n) ** 2 - (success / n) ** 2;
  };
  const size = ([fail, success]) => fail + success;
  const totals = new Array(model.feature_names.length).fill(0);

  model.children_left.forEach((left, node) => {
    if (left === -1) return;
    const right = model.children_right[node];
    const [parent, l, r] = [model.value[node], model.value[left], model.value[right]];
    totals[model.feature[node]] += size(parent) * gini(parent) - size(l) * gini(l) - size(r) * gini(r);
  });

  const sum = totals.reduce((a, b) => a + b, 0) || 1;
  return model.feature_names
    .map((feature, i) => ({ feature, importance: Math.round((Math.max(0, totals[i]) / sum) * 10000) / 10000 }))
    .sort((a, b) => b.importance - a.importance);
}

/** Share of successful training sessions at a node, Laplace-smoothed so small leaves are not 0% or 100%. */
function successRate(counts) {
  const [fail, success] = counts;
  return (success + 1) / (fail + success + 2);
}

/**
 * Walk the tree for one session and record every decision taken.
 *
 * @param {object} features one value per FEATURE_NAMES entry
 * @param {object} [model]  defaults to the loaded model
 * @returns {{
 *   probability: number,      chance of success at the leaf (0–1)
 *   predictedClass: 0|1,
 *   label: string,
 *   baseRate: number,         chance of success at the root, before any split
 *   leaf: { node: number, samples: number },
 *   path: { node: number, feature: string, threshold: number, direction: '<='|'>', value: number,
 *           samples: number, probabilityBefore: number, probabilityAfter: number }[]
 * }}
 */
function predictWithPath(features, model = treeModel) {
  if (!model) throw new Error('No trained model is loaded');

  const vector = toVector(features);
  const steps = [];
  let node = 0;

  while (model.children_left[node] !== -1) {
    const featureIdx = model.feature[node];
    const threshold = model.threshold[node];
    const value = vector[featureIdx];
    const goLeft = value <= threshold;
    const child = goLeft ? model.children_left[node] : model.children_right[node];

    steps.push({
      node,
      feature: model.feature_names[featureIdx],
      threshold,
      direction: goLeft ? '<=' : '>',
      value,
      samples: model.value[child][0] + model.value[child][1],
      probabilityBefore: successRate(model.value[node]),
      probabilityAfter: successRate(model.value[child]),
    });
    node = child;
  }

  const counts = model.value[node];
  const predictedClass = model.node_class[node];

  return {
    probability: successRate(counts),
    predictedClass,
    label: CLASS_NAMES[predictedClass],
    baseRate: successRate(model.value[0]),
    leaf: { node, samples: counts[0] + counts[1] },
    path: steps,
  };
}

// Load on import
loadModel();

module.exports = {
  MODEL_PATH,
  MIN_REAL_SESSIONS,
  CLASS_NAMES,
  loadModel,
  getModel,
  getModelState,
  getModelInfo,
  computeFeatureImportances,
  isCompatible,
  predictWithPath,
};
