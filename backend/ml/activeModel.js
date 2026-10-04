/**
 * Active model — which trained model answers predictions, and one interface
 * over both kinds.
 *
 * ML_MODEL=logreg (default) uses the logistic regression; ML_MODEL=tree uses
 * the decision tree. When logistic regression is asked for but its JSON is
 * missing or invalid, the decision tree is used instead (with a warning);
 * when neither exists, callers fall back to each user's past success rate.
 *
 * Every function that takes a model works out its kind from the JSON itself,
 * so tests and callers can pass either kind directly.
 */

const tree = require('./decisionTreeModel');
const logreg = require('./logisticRegressionModel');

const MODEL_KINDS = Object.freeze(['logreg', 'tree']);
const { MIN_REAL_SESSIONS } = tree;

let warnedFallback = false;

/** The kind asked for in ML_MODEL ('logreg' when unset or unrecognised). */
function requestedKind() {
  const kind = String(process.env.ML_MODEL || 'logreg').trim().toLowerCase();
  return MODEL_KINDS.includes(kind) ? kind : 'logreg';
}

/** 'logreg' | 'tree' | null, from the shape of a model JSON. */
function kindOf(model) {
  if (!model) return null;
  if (model.kind === 'logistic_regression') return 'logreg';
  if (Array.isArray(model.children_left)) return 'tree';
  return null;
}

/** The model that answers predictions right now, or null. */
function getActiveModel() {
  if (requestedKind() === 'logreg') {
    const model = logreg.getModel();
    if (model) return model;
    if (tree.getModel() && !warnedFallback) {
      warnedFallback = true;
      console.warn('[ML] ML_MODEL=logreg but no usable logistic regression model — using the decision tree');
    }
  }
  return tree.getModel();
}

/** Reload the model files of one kind (after retraining). */
function reload(kind = requestedKind()) {
  warnedFallback = false;
  return kind === 'tree' ? tree.loadModel() : logreg.loadModel();
}

/** Common metadata, whichever kind. */
function describe(model) {
  const kind = kindOf(model);
  if (kind === 'logreg') return { kind, version: model.version, trainedAt: model.trainedAt, nReal: model.nReal };
  if (kind === 'tree') return { kind, version: model.model_version, trainedAt: model.trained_at, nReal: model.n_real };
  return { kind: null, version: null, trainedAt: null, nReal: 0 };
}

/**
 * Minimum-data guard.
 *
 * @param {object|null} [model] defaults to the active model
 * @returns {{ ready: boolean, reason: string|null, kind: string|null, nReal: number, minRequired: number,
 *             modelVersion: string|null, trainedAt: string|null }}
 */
function getModelState(model = getActiveModel()) {
  const { kind, version, trainedAt, nReal = 0 } = describe(model);
  let reason = null;
  if (!kind) reason = 'no_model';
  else if ((nReal || 0) < MIN_REAL_SESSIONS) reason = 'insufficient_data';
  return {
    ready: reason === null,
    reason,
    kind,
    nReal: nReal || 0,
    minRequired: MIN_REAL_SESSIONS,
    modelVersion: version || null,
    trainedAt: trainedAt || null,
  };
}

/** Version and size of a model, for display. Null when there is no model. */
function getModelInfo(model = getActiveModel()) {
  const kind = kindOf(model);
  if (kind === 'tree') return { kind, ...tree.getModelInfo(model) };
  if (kind === 'logreg') {
    return {
      kind,
      version: model.version || null,
      trainedAt: model.trainedAt || null,
      features: model.featureNames,
      regularization: model.C,
    };
  }
  return null;
}

/**
 * Predict one session with either kind.
 * @returns {object} the kind's own result plus `kind`; always has probability and predictedClass
 */
function predict(features, model = getActiveModel()) {
  const kind = kindOf(model);
  if (kind === 'logreg') return { kind, ...logreg.predict(features, model) };
  if (kind === 'tree') return { kind, ...tree.predictWithPath(features, model) };
  throw new Error('No trained model is loaded');
}

function computeFeatureImportances(model = getActiveModel()) {
  const kind = kindOf(model);
  if (kind === 'logreg') return logreg.computeFeatureImportances(model);
  if (kind === 'tree') return tree.computeFeatureImportances(model);
  return [];
}

module.exports = {
  MODEL_KINDS,
  MIN_REAL_SESSIONS,
  requestedKind,
  kindOf,
  getActiveModel,
  reload,
  getModelState,
  getModelInfo,
  predict,
  computeFeatureImportances,
};
