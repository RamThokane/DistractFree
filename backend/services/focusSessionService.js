/**
 * Focus Session Service — the one place a FocusSession is created.
 *
 * Used by POST /api/session/start, by scheduled sessions that start
 * automatically, and by "start now" on a scheduled session, so all of them
 * snapshot the blocked sites and store the pre-session prediction the same way.
 */

const FocusSession = require('../models/FocusSession');
const BlockedWebsite = require('../models/BlockedWebsite');
const { predictForUser } = require('./predictionService');

/**
 * Predict a session without ever failing the request that asked for it.
 * @returns {Promise<object|null>}
 */
async function safePredict(userId, options) {
  try {
    return await predictForUser(userId, options);
  } catch (error) {
    console.error('[Session] Prediction error:', error.message);
    return null;
  }
}

/**
 * Create an active FocusSession starting now. The caller checks that the
 * user has no active session.
 *
 * @param {object}  input
 * @param {ObjectId} input.userId
 * @param {number}  input.plannedDuration minutes
 * @param {string} [input.timezone]       IANA timezone
 * @param {ObjectId} [input.scheduledSessionId] the schedule this session came from
 * @returns {Promise<{ session: object, prediction: object|null }>}
 */
async function createFocusSession({ userId, plannedDuration, timezone, scheduledSessionId = null }) {
  // Snapshot of blocked sites for this session
  const blockedSites = await BlockedWebsite.find({ userId, isActive: true });
  const blockedUrls = blockedSites.map((s) => s.websiteUrl);

  // Pre-session prediction: made from what is known right now, before the
  // session exists, and stored so it can be scored once the session ends.
  const startTime = new Date();
  const prediction = await safePredict(userId, { startTime, plannedDuration, timezone });

  const session = await FocusSession.create({
    userId,
    plannedDuration,
    startTime,
    blockedSitesUsed: blockedUrls,
    scheduledSessionId,
    timezone: prediction?.timezone || null,
    predictedSuccessProb: prediction?.successProbability ?? null,
    predictedSuccess: prediction?.predictedSuccess ?? null,
    predictionSource: prediction && prediction.successProbability !== null ? prediction.source : null,
    modelVersion: prediction?.source === 'model' ? prediction.modelVersion : null,
    predictionReasons: (prediction?.reasons || []).slice(0, 3).map((r) => r.text),
  });

  return { session, prediction };
}

module.exports = { safePredict, createFocusSession };
