/**
 * Decision Tree Model — JavaScript implementation.
 *
 * This module loads a trained model exported from scikit-learn (via trainModel.py)
 * and performs inference in Node.js. It falls back to a rule-based heuristic
 * if no trained model is available.
 *
 * The Python training pipeline serialises the tree as a JSON structure
 * that this module traverses at prediction time.
 */

const fs = require('fs');
const path = require('path');

const MODEL_PATH = path.resolve(__dirname, 'model', 'decision_tree_model.json');

let treeModel = null;

// ── Feature encoding maps ──────────────────────────
const TIME_OF_DAY_MAP = { morning: 0, afternoon: 1, evening: 2, night: 3 };
const CATEGORY_MAP = {
  social_media: 0,
  entertainment: 1,
  news: 2,
  shopping: 3,
  gaming: 4,
  streaming: 5,
  messaging: 6,
  other: 7,
};
const RISK_LABELS = ['low', 'medium', 'high'];

/**
 * Load the serialised decision tree model from disk.
 */
const loadModel = () => {
  try {
    if (fs.existsSync(MODEL_PATH)) {
      const raw = fs.readFileSync(MODEL_PATH, 'utf-8');
      treeModel = JSON.parse(raw);
      console.log('[ML] Decision tree model loaded successfully');
      return true;
    }
    console.warn('[ML] No trained model found at', MODEL_PATH, '— using heuristic fallback');
    return false;
  } catch (err) {
    console.error('[ML] Failed to load model:', err.message);
    return false;
  }
};

/**
 * Encode raw features into a numeric vector matching the training schema.
 *
 * @param {object} features
 * @returns {number[]}
 */
const encodeFeatures = (features) => {
  return [
    TIME_OF_DAY_MAP[features.timeOfDay] ?? 1,
    CATEGORY_MAP[features.websiteCategory] ?? 7,
    features.sessionDuration ?? 25,
    features.previousDistractions ?? 0,
    features.focusScore ?? 50,
  ];
};

/**
 * Traverse a serialised scikit-learn DecisionTreeClassifier.
 *
 * The JSON schema (produced by trainModel.py) stores parallel arrays:
 *   - children_left[i]   — left child index of node i (−1 = leaf)
 *   - children_right[i]  — right child index of node i
 *   - feature[i]         — feature index used for splitting
 *   - threshold[i]       — split threshold
 *   - value[i]           — class distribution at this node
 */
const traverseTree = (tree, features) => {
  let nodeIdx = 0;

  while (tree.children_left[nodeIdx] !== -1) {
    const featureIdx = tree.feature[nodeIdx];
    const threshold = tree.threshold[nodeIdx];

    if (features[featureIdx] <= threshold) {
      nodeIdx = tree.children_left[nodeIdx];
    } else {
      nodeIdx = tree.children_right[nodeIdx];
    }
  }

  // Leaf node — value is [[count_class_0, count_class_1, count_class_2]]
  const classCounts = tree.value[nodeIdx][0];
  const total = classCounts.reduce((a, b) => a + b, 0);
  const predictedClass = classCounts.indexOf(Math.max(...classCounts));
  const confidence = total > 0 ? Math.round((classCounts[predictedClass] / total) * 100) : 0;

  return {
    riskLevel: RISK_LABELS[predictedClass] || 'medium',
    confidence,
    classProbabilities: {
      low: total > 0 ? Math.round((classCounts[0] / total) * 100) : 33,
      medium: total > 0 ? Math.round((classCounts[1] / total) * 100) : 34,
      high: total > 0 ? Math.round((classCounts[2] / total) * 100) : 33,
    },
  };
};

/**
 * Heuristic fallback when no trained model is available.
 */
const heuristicPredict = (features) => {
  let riskScore = 0;

  // Time of day
  if (features.timeOfDay === 'evening' || features.timeOfDay === 'night') riskScore += 25;
  else if (features.timeOfDay === 'afternoon') riskScore += 10;

  // Website category
  const highRiskCategories = ['social_media', 'entertainment', 'gaming', 'streaming'];
  if (highRiskCategories.includes(features.websiteCategory)) riskScore += 25;

  // Short sessions are riskier
  if (features.sessionDuration < 15) riskScore += 15;
  else if (features.sessionDuration < 25) riskScore += 5;

  // Previous distractions
  riskScore += Math.min(features.previousDistractions * 8, 20);

  // Low focus score
  if (features.focusScore < 40) riskScore += 15;
  else if (features.focusScore < 60) riskScore += 5;

  let riskLevel;
  if (riskScore >= 50) riskLevel = 'high';
  else if (riskScore >= 25) riskLevel = 'medium';
  else riskLevel = 'low';

  return {
    riskLevel,
    confidence: Math.min(95, 60 + Math.abs(riskScore - 37)),
    classProbabilities: {
      low: riskLevel === 'low' ? 70 : 15,
      medium: riskLevel === 'medium' ? 70 : 15,
      high: riskLevel === 'high' ? 70 : 15,
    },
  };
};

/**
 * Predict distraction risk for the given features.
 *
 * @param {object} features — { timeOfDay, websiteCategory, sessionDuration, previousDistractions, focusScore }
 * @returns {{ riskLevel: string, confidence: number, classProbabilities: object }}
 */
const predict = (features) => {
  if (treeModel) {
    const encoded = encodeFeatures(features);
    return traverseTree(treeModel, encoded);
  }

  return heuristicPredict(features);
};

// Attempt to load model on module import
loadModel();

module.exports = { predict, loadModel, encodeFeatures };
