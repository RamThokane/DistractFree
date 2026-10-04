/**
 * Model inputs — derived columns computed from the pre-session features.
 *
 * buildFeatures() (featureBuilder.js) stays the single source of the raw
 * features. This module adds the columns a linear model needs and a tree does
 * not: the start hour as a point on a 24-hour circle, so 23:00 and 00:00 are
 * neighbours rather than 23 units apart.
 *
 * Used by both paths, so they cannot diverge:
 *   - extractTrainingData.js writes these columns into the training CSV,
 *     which train_model.py reads as-is (Python never recomputes them)
 *   - logisticRegressionModel.js applies them at inference
 *
 * This module is pure: no database access, no clock reads.
 */

const { FEATURE_NAMES } = require('./featureBuilder');

const DERIVED_FEATURE_NAMES = Object.freeze(['hourSin', 'hourCos']);

// Every column a model may be trained on, in CSV order
const MODEL_INPUT_NAMES = Object.freeze([...FEATURE_NAMES, ...DERIVED_FEATURE_NAMES]);

const hourAngle = (hour) => (2 * Math.PI * Number(hour)) / 24;

/**
 * The raw features plus the derived columns.
 * @param {object} features one value per FEATURE_NAMES entry
 * @returns {object} one value per MODEL_INPUT_NAMES entry
 */
function toModelInputs(features) {
  return {
    ...features,
    hourSin: Math.sin(hourAngle(features.hourOfDay)),
    hourCos: Math.cos(hourAngle(features.hourOfDay)),
  };
}

module.exports = { DERIVED_FEATURE_NAMES, MODEL_INPUT_NAMES, toModelInputs };
