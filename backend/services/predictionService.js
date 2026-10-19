/**
 * Prediction Service — "will this user's next focus session succeed?"
 *
 * The single entry point for predictions. Session start, the insights page
 * and the dashboard all go through predictForUser(), which:
 *   1. loads the user's earlier sessions
 *   2. builds pre-session features with the shared feature builder
 *   3. applies the minimum-data guard
 *   4. runs the active model (logistic regression by default, decision tree
 *      with ML_MODEL=tree — see ml/activeModel.js) and explains the result
 *
 * While the model has too little real data it is not used at all: the
 * response says so and reports the user's own past success rate instead.
 */

const FocusSession = require('../models/FocusSession');
const { ENDED_STATUSES } = require('../ml/target');
const { buildFeatures, isValidTimezone, HISTORY_WINDOW, DEFAULT_TIMEZONE } = require('../ml/featureBuilder');
const { getActiveModel, getModelState, getModelInfo, predict, refreshFromDb } = require('../ml/activeModel');
const {
  explainPath,
  explainContributions,
  describePath,
  describeContributions,
  describeInputs,
  bestCounterfactual,
} = require('../ml/explain');

const DEFAULT_PLANNED_DURATION = 25;
const HISTORY_FIELDS = 'startTime endTime plannedDuration duration status distractionAttempts tabSwitches timezone';

// Success probability → the low/medium/high risk level existing UI components expect
const RISK_THRESHOLDS = { low: 0.65, medium: 0.4 };

function riskFromProbability(probability) {
  if (probability === null || probability === undefined) return null;
  if (probability >= RISK_THRESHOLDS.low) return 'low';
  if (probability >= RISK_THRESHOLDS.medium) return 'medium';
  return 'high';
}

const pct = (x) => `${Math.round(x * 100)}%`;

/**
 * Pure prediction core (no database access).
 *
 * @param {object}   input
 * @param {object[]} input.sessions        the user's sessions
 * @param {Date}     input.startTime       start of the session being predicted
 * @param {number}   input.plannedDuration minutes
 * @param {string}  [input.timezone]
 * @param {object}  [input.model]          defaults to the loaded model
 */
function predictFromHistory({ sessions, startTime, plannedDuration, timezone, model = getActiveModel() }) {
  const { features, context } = buildFeatures({ sessions, startTime, plannedDuration, timezone });
  const state = getModelState(model);
  const baseline = { successRate: context.overallRate, sessions: context.historyCount };
  const common = {
    plannedDuration,
    features,
    inputFeatures: describeInputs(features),
    // No earlier sessions: history features are neutral defaults
    isColdStart: context.historyCount === 0,
    baseline,
    modelVersion: state.modelVersion,
    modelInfo: getModelInfo(model),
  };

  if (!state.ready) {
    const probability = baseline.successRate;
    return {
      ...common,
      status: 'learning',
      source: 'baseline',
      successProbability: probability,
      predictedSuccess: probability === null ? null : probability >= 0.5,
      riskLevel: riskFromProbability(probability),
      reasons: [],
      path: [],
      counterfactual: null,
      // User-facing text: plain language, no model or training details
      message: "We're still learning your focus habits, so for now this is based on your own past sessions.",
      explanation: probability === null
        ? 'Finish your first focus session to get a prediction.'
        : `${pct(probability)} of your last ${baseline.sessions} sessions went to plan.`,
    };
  }

  const prediction = predict(features, model);
  const counterfactual = bestCounterfactual(features, context, model);
  const isTree = prediction.kind === 'tree';

  return {
    ...common,
    status: 'ready',
    source: 'model',
    successProbability: prediction.probability,
    predictedSuccess: prediction.predictedClass === 1,
    riskLevel: riskFromProbability(prediction.probability),
    reasons: isTree ? explainPath(prediction, features) : explainContributions(prediction, features),
    path: isTree ? describePath(prediction, features) : describeContributions(prediction, features),
    leafSamples: isTree ? prediction.leaf.samples : null,
    counterfactual,
    message: null,
    explanation:
      `A ${plannedDuration}-minute session started now has a ${pct(prediction.probability)} chance of going to plan.` +
      (counterfactual ? ` ${counterfactual.text}.` : ''),
  };
}

/** The planned length this user picks most often lately. */
function typicalPlannedDuration(sessions) {
  const counts = {};
  for (const s of sessions.slice(0, 5)) counts[s.plannedDuration] = (counts[s.plannedDuration] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? Number(top[0]) : DEFAULT_PLANNED_DURATION;
}

/**
 * Predict a session for a user, as of `startTime`.
 *
 * @param {ObjectId} userId
 * @param {object}  [options]
 * @param {Date}    [options.startTime=now]
 * @param {number}  [options.plannedDuration] defaults to the user's usual length
 * @param {string}  [options.timezone]        defaults to the one on their latest session
 */
async function predictForUser(userId, { startTime = new Date(), plannedDuration, timezone } = {}) {
  await refreshFromDb(); // newest retrained model, checked at most once a minute
  // Newest first, so the limit keeps the most recent window
  const sessions = await FocusSession.find({
    userId,
    status: { $in: ENDED_STATUSES },
    startTime: { $lt: startTime },
  })
    .sort({ startTime: -1 })
    .limit(HISTORY_WINDOW)
    .select(HISTORY_FIELDS)
    .lean();

  const tz = isValidTimezone(timezone)
    ? timezone
    : sessions.find((s) => isValidTimezone(s.timezone))?.timezone || DEFAULT_TIMEZONE;

  return {
    ...predictFromHistory({
      sessions,
      startTime,
      plannedDuration: plannedDuration || typicalPlannedDuration(sessions),
      timezone: tz,
    }),
    timezone: tz,
  };
}

/**
 * Probability of each class the model has. The model is binary
 * (successful / not successful); riskLevel is derived from these.
 */
function classProbabilities(probability) {
  if (probability === null || probability === undefined) return null;
  return { successful: probability, not_successful: 1 - probability };
}

/** The client-facing part of a prediction. */
function toClientPrediction(p) {
  const known = p.successProbability !== null && p.successProbability !== undefined;
  return {
    status: p.status,
    source: p.source,
    successProbability: p.successProbability,
    successPercent: known ? Math.round(p.successProbability * 100) : null,
    classProbabilities: classProbabilities(p.successProbability),
    // How sure the prediction is of its more likely outcome
    confidence: known ? Math.max(p.successProbability, 1 - p.successProbability) : null,
    predictedSuccess: p.predictedSuccess,
    riskLevel: p.riskLevel,
    plannedDuration: p.plannedDuration,
    isColdStart: p.isColdStart,
    reasons: p.reasons,
    path: p.path,
    leafSamples: p.leafSamples ?? null,
    inputFeatures: p.inputFeatures,
    counterfactual: p.counterfactual,
    baseline: p.baseline,
    message: p.message,
    explanation: p.explanation,
    modelVersion: p.modelVersion,
    modelInfo: p.modelInfo,
  };
}

/** The stored start-of-session prediction, as returned while a session runs. */
function storedSessionPrediction(session) {
  const probability = session.predictedSuccessProb;
  if (probability === null || probability === undefined) return null;
  return {
    source: session.predictionSource,
    successProbability: probability,
    successPercent: Math.round(probability * 100),
    classProbabilities: classProbabilities(probability),
    confidence: Math.max(probability, 1 - probability),
    riskLevel: riskFromProbability(probability),
    topReason: session.predictionReasons?.[0] || null,
    reasons: session.predictionReasons || [],
    modelVersion: session.modelVersion,
  };
}

/**
 * Reasons in the { feature, value, impact, explanation } shape the existing
 * "Key Contributing Factors" cards render.
 */
function toLegacyTopFeatures(reasons) {
  return reasons.map((r) => ({
    feature: r.label,
    value: r.value,
    impact: r.effect === 'raises' ? 'positive' : r.effect === 'neutral' ? 'low' : Math.abs(r.delta) >= 0.15 ? 'high' : 'medium',
    explanation: r.text,
  }));
}

const realEndedFilter = (extra = {}) => ({
  source: { $ne: 'simulated' },
  status: { $in: ENDED_STATUSES },
  ...extra,
});

/** How many real, finished sessions exist (optionally: started after `since`). */
function countRealSessions(since = null) {
  return FocusSession.countDocuments(realEndedFilter(since ? { startTime: { $gt: since } } : {}));
}

/**
 * Live accuracy: predictions stored at session start vs. what actually happened.
 * Only model predictions on real sessions count; baseline-only sessions are excluded.
 */
async function getLiveAccuracy() {
  const scored = await FocusSession.find(realEndedFilter({
    predictionSource: 'model',
    predictedSuccessProb: { $ne: null },
    actualSuccess: { $ne: null },
  }))
    .select('predictedSuccessProb predictedSuccess actualSuccess modelVersion')
    .lean();

  if (scored.length === 0) return { n: 0, accuracy: null, brierScore: null, byModelVersion: {} };

  const summarise = (rows) => ({
    n: rows.length,
    accuracy: rows.filter((s) => Boolean(s.predictedSuccess) === Boolean(s.actualSuccess)).length / rows.length,
    brierScore: rows.reduce((sum, s) => sum + (s.predictedSuccessProb - (s.actualSuccess ? 1 : 0)) ** 2, 0) / rows.length,
  });

  const versions = {};
  for (const s of scored) (versions[s.modelVersion || 'unknown'] ||= []).push(s);

  return {
    ...summarise(scored),
    byModelVersion: Object.fromEntries(Object.entries(versions).map(([v, rows]) => [v, summarise(rows)])),
  };
}

module.exports = {
  RISK_THRESHOLDS,
  riskFromProbability,
  predictFromHistory,
  predictForUser,
  classProbabilities,
  toClientPrediction,
  storedSessionPrediction,
  toLegacyTopFeatures,
  countRealSessions,
  getLiveAccuracy,
};
