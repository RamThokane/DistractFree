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
const DB_REFRESH_MS = 60 * 1000;
let lastDbCheck = 0;
let modelSource = 'file';
let refreshing = null;
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

/**
 * Use the newest model stored in MongoDB (trained by ml/nodeTrainer.js after
 * sessions end). Checked at most once a minute unless forced, so every
 * server instance catches up quickly. The bundled JSON file stays the
 * fallback when the database has no model yet. Never throws.
 */
function refreshFromDb({ force = false } = {}) {
  if (requestedKind() !== 'logreg') return Promise.resolve(false);
  if (!force && Date.now() - lastDbCheck < DB_REFRESH_MS) return Promise.resolve(false);
  if (refreshing) return refreshing;
  lastDbCheck = Date.now();
  refreshing = (async () => {
    try {
      const MlModel = require('../models/MlModel');
      const doc = await MlModel.findOne().sort({ trainedAt: -1 }).lean();
      if (!doc) return false;
      const current = logreg.getModel();
      if (current && current.version === doc.version) return false;
      const model = { ...doc, trainedAt: new Date(doc.trainedAt).toISOString() };
      if (!logreg.setModel(model)) return false;
      modelSource = 'database';
      console.log(`[ML] Using ${doc.version} from the database (${doc.nReal} sessions, walk-forward AUC ${doc.metrics?.walkForward?.roc_auc ?? 'n/a'})`);
      return true;
    } catch (err) {
      console.error('[ML] Model refresh from database failed:', err.message);
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** 'database' once a stored model is in use, otherwise 'file'. */
const getModelSource = () => modelSource;

/** Walk-forward ROC-AUC of the active model (stored models carry their own; the file model's is in its report). */
function getWalkForwardAuc(model = getActiveModel()) {
  const own = model?.metrics?.walkForward?.roc_auc;
  if (typeof own === 'number') return own;
  try {
    return require('./trainModel').getTrainingReport()?.walk_forward?.model?.roc_auc ?? null;
  } catch {
    return null;
  }
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
      source: modelSource,
      nReal: model.nReal || null,
      nUsers: model.nUsers || null,
      walkForwardAuc: getWalkForwardAuc(model),
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
  refreshFromDb,
  getModelSource,
  getWalkForwardAuc,
  getModelState,
  getModelInfo,
  predict,
  computeFeatureImportances,
};
