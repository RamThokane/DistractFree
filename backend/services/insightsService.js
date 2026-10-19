/**
 * Insights Service — everything the AI Insights page shows, in one call.
 *
 * Used by GET /api/insights/full and by the AI assistant's getInsights tool,
 * so the assistant explains exactly the numbers the page shows.
 */

const { recommendForUser, forecastForUser } = require('./sessionRecommender');
const { toClientPrediction, toLegacyTopFeatures } = require('./predictionService');
const {
  getHourlyActivity,
  getProductivityWindows,
  getHighDistractionHours,
  getTrendAnalytics,
  computeUserFeatures,
  getDistractionBreakdown,
  getTopSites,
} = require('./analyticsService');
const { generateRecommendations, getSessionRecommendation } = require('./recommendationService');

function dominantCategory(topSites) {
  if (!topSites || topSites.length === 0) return 'other';
  // The site with the most duration
  return topSites[0]?.category || 'other';
}

/**
 * @param {string|ObjectId} userId
 * @param {string} [requestedTz] the browser's IANA timezone, if sent
 * @returns {Promise<object>} the insights payload (without `success`)
 */
async function buildFullInsights(userId, requestedTz) {
  const tz = requestedTz || 'UTC'; // User's IANA timezone (e.g. 'Asia/Kolkata'); validated downstream

  // Run all analytics in parallel for performance
  const [features, hourly, trends, breakdown, topSites] = await Promise.all([
    computeUserFeatures(userId, 7, tz),
    getHourlyActivity(userId, 30, tz),
    getTrendAnalytics(userId, 7, tz),
    getDistractionBreakdown(userId, 7),
    getTopSites(userId, 7),
  ]);
  // Focus windows and risk hours share the same hourly data so they stay consistent
  const [productivity, distraction] = await Promise.all([
    getProductivityWindows(userId, 30, tz, hourly),
    getHighDistractionHours(userId, 30, tz, hourly),
  ]);

  // ── ML Prediction: will the next session succeed? ──
  // Pre-session features only; reasons come from the active model (logistic
  // regression input effects, or the decision tree's path with ML_MODEL=tree).
  const category = dominantCategory(topSites);
  const mlPrediction = await forecastForUser(userId, { timezone: requestedTz });

  // ── Recommendations ────────────────────────────
  const recommendations = generateRecommendations(
    features, productivity, distraction, mlPrediction, trends
  );
  // Same length as "Best next session", so the two never disagree
  const nextBest = await recommendForUser(userId, { timezone: requestedTz }).catch(() => null);
  const sessionRec = nextBest?.status === 'ready'
    ? getSessionRecommendation(features, { ...productivity, optimalSessionLength: nextBest.best.plannedDuration })
    : getSessionRecommendation(features, productivity);

  // ── Assemble response ──────────────────────────
  return {
    // Prediction. riskLevel / topFeatures / explanation keep their old shape
    // for existing UI; they now come from the success probability and the model's reasons.
    prediction: {
      ...toClientPrediction(mlPrediction),
      topFeatures: toLegacyTopFeatures(mlPrediction.reasons),
      // Descriptive 7-day composites (not model outputs)
      distractionScore: features.distractionScore,
      focusScore: features.focusScore,
    },

    // Feature details
    features: {
      ...features,
      timeOfDay: features.timeOfDay,
      dominantCategory: category,
    },

    // Distraction breakdown
    breakdown,

    // Productivity windows
    productivityWindows: productivity,

    // High distraction hours
    distractionHours: distraction,

    // Recommendations
    recommendations,
    sessionRecommendation: sessionRec,

    // 7-day trends
    trends,

    // Top sites
    topSites,

    // Meta
    // hasSessions / totalSessions cover the last 7 days (analytics window).
    // The prediction is always returned; isColdStart means the user has no
    // finished sessions at all, so it rests on default values.
    dataStatus: {
      hasSessions: features.totalSessions > 0,
      hasEnoughData: features.totalSessions >= 3,
      totalSessions: features.totalSessions,
      totalBrowsingEvents: features.totalBrowsingEvents,
      dataRange: '7 days',
      allTimeFinishedSessions: mlPrediction.baseline.sessions,
      isColdStart: mlPrediction.isColdStart,
    },
  };
}

module.exports = { buildFullInsights };
