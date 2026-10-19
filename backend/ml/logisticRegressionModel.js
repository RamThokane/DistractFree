/**
 * Logistic Regression Model — Node.js inference for the model trained in Python.
 *
 * train_model.py fits a scikit-learn StandardScaler + LogisticRegression
 * pipeline and exports it as JSON. This module loads that file and computes
 *
 *   p(success) = sigmoid(intercept + Σ coef_i · (x_i − mean_i) / std_i)
 *
 * with no Python at runtime. Inputs come from toModelInputs() (modelInputs.js),
 * the same transform used to write the training CSV.
 *
 * JSON schema:
 *   kind                      'logistic_regression'
 *   version, trainedAt
 *   featureNames[]            the inputs used, in order (a subset of MODEL_INPUT_NAMES)
 *   means[], stds[]           StandardScaler parameters, one per feature
 *   coefficients[], intercept on the scaled inputs
 *   C, metrics, nSamples, nReal, nSimulated, classBalance
 */

const fs = require('fs');
const path = require('path');
const { MODEL_INPUT_NAMES, toModelInputs } = require('./modelInputs');

const MODEL_PATH = path.resolve(__dirname, 'model', 'logistic_regression_model.json');
const CLASS_NAMES = ['not_successful', 'successful'];

let lrModel = null;

const isNumberArray = (xs, length) => Array.isArray(xs) && xs.length === length && xs.every(Number.isFinite);

/** Usable only if every input is one we compute and every parameter array lines up. */
function isCompatible(model) {
  if (!model || model.kind !== 'logistic_regression' || !Array.isArray(model.featureNames)) return false;
  const n = model.featureNames.length;
  return (
    n > 0 &&
    model.featureNames.every((name) => MODEL_INPUT_NAMES.includes(name)) &&
    isNumberArray(model.means, n) &&
    isNumberArray(model.stds, n) &&
    model.stds.every((s) => s > 0) &&
    isNumberArray(model.coefficients, n) &&
    Number.isFinite(model.intercept)
  );
}

/** Load the exported model from disk. Returns true when a compatible model is in memory. */
function loadModel() {
  lrModel = null;
  try {
    if (!fs.existsSync(MODEL_PATH)) {
      console.warn('[ML] No logistic regression model at', MODEL_PATH);
      return false;
    }
    const model = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf-8'));
    if (!isCompatible(model)) {
      console.warn('[ML] Logistic regression model file is invalid or does not match the feature builder — retrain with `npm run ml:retrain`');
      return false;
    }
    lrModel = model;
    console.log(`[ML] Logistic regression ${model.version} loaded (${model.featureNames.length} features, ${model.nReal} real sessions at training)`);
    return true;
  } catch (err) {
    console.error('[ML] Failed to load logistic regression model:', err.message);
    return false;
  }
}

const getModel = () => lrModel;

/** Swap in a model (e.g. the latest from MongoDB). Returns false if it isn't usable. */
function setModel(model) {
  if (!isCompatible(model)) return false;
  lrModel = model;
  return true;
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/**
 * Predict one session.
 *
 * @param {object} features one value per FEATURE_NAMES entry (raw, from buildFeatures)
 * @param {object} [model]  defaults to the loaded model
 * @returns {{
 *   probability: number,  chance of success (0–1)
 *   predictedClass: 0|1,
 *   label: string,
 *   logit: number,
 *   contributions: { feature: string, value: number, scaled: number, coefficient: number, contribution: number }[]
 * }} contributions are coef_i · scaled_i, in featureNames order; they sum with the intercept to the logit
 */
function predict(features, model = lrModel) {
  if (!model) throw new Error('No trained model is loaded');

  const inputs = toModelInputs(features);
  const contributions = model.featureNames.map((feature, i) => {
    const value = Number(inputs[feature]);
    const scaled = (value - model.means[i]) / model.stds[i];
    return { feature, value, scaled, coefficient: model.coefficients[i], contribution: model.coefficients[i] * scaled };
  });

  const logit = contributions.reduce((sum, c) => sum + c.contribution, model.intercept);
  // scikit-learn predicts the positive class only when the decision function is > 0
  const predictedClass = logit > 0 ? 1 : 0;

  return { probability: sigmoid(logit), predictedClass, label: CLASS_NAMES[predictedClass], logit, contributions };
}

/**
 * Feature importance for a linear model on standardised inputs: |coefficient|,
 * normalised to sum to 1.
 * @returns {{ feature: string, importance: number, coefficient: number }[]} highest first
 */
function computeFeatureImportances(model = lrModel) {
  if (!model) return [];
  const sum = model.coefficients.reduce((s, c) => s + Math.abs(c), 0) || 1;
  return model.featureNames
    .map((feature, i) => ({
      feature,
      importance: Math.round((Math.abs(model.coefficients[i]) / sum) * 10000) / 10000,
      coefficient: model.coefficients[i],
    }))
    .sort((a, b) => b.importance - a.importance);
}

// Load on import
loadModel();

module.exports = {
  MODEL_PATH,
  CLASS_NAMES,
  sigmoid,
  loadModel,
  getModel,
  setModel,
  isCompatible,
  predict,
  computeFeatureImportances,
};
