/**
 * Insights Controller — AI Behavioral Intelligence API
 *
 * This controller orchestrates the analytics, ML, and recommendation services
 * to deliver a comprehensive, live, data-driven insights payload.
 *
 * Endpoints:
 *   GET /api/insights/full       — Full AI insights (prediction + analytics + recommendations)
 *   GET /api/insights/predict    — ML prediction only (legacy compat)
 *   GET /api/insights/model      — Model transparency: training report + live accuracy
 *   GET /api/insights/analytics  — Browsing analytics only
 *   POST /api/insights/browsing/log — Log a browsing event
 *   GET /api/insights/weekly-report — CSV export
 */

const BrowsingLog = require('../models/BrowsingLog');
const FocusSession = require('../models/FocusSession');
const { getModelState, getModelInfo, computeFeatureImportances } = require('../ml/activeModel');
const { getTrainingReport, AUTO_RETRAIN_NEW_SESSIONS } = require('../ml/trainModel');
const { recommendForUser, forecastForUser } = require('../services/sessionRecommender');
const {

  toClientPrediction,
  toLegacyTopFeatures,
  countRealSessions,
  getLiveAccuracy,
} = require('../services/predictionService');
const {
  getHourlyActivity,
  getProductivityWindows,
  getHighDistractionHours,
  getTrendAnalytics,
  computeUserFeatures,
  getDistractionBreakdown,
  getTopSites,
  getProductivityHeatmap,
  getYearlyHeatmap,
} = require('../services/analyticsService');
const {
  generateRecommendations,
  getSessionRecommendation,
} = require('../services/recommendationService');

// ────────────────────────────────────────────────────
// GET /api/insights/full
// The main endpoint for the AI Insights page.
// Returns everything the frontend needs in a single call.
// ────────────────────────────────────────────────────
exports.getFullInsights = async (req, res) => {
  try {
    const userId = req.user._id;
    const tz = req.query.tz || 'UTC'; // User's IANA timezone (e.g. 'Asia/Kolkata'); validated downstream

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
    const dominantCategory = _getDominantCategory(topSites);
    const mlPrediction = await forecastForUser(userId, { timezone: req.query.tz });

    // ── Recommendations ────────────────────────────
    const recommendations = generateRecommendations(
      features, productivity, distraction, mlPrediction, trends
    );
    // Same length as "Best next session", so the two never disagree
    const nextBest = await recommendForUser(userId, { timezone: req.query.tz }).catch(() => null);
    const sessionRec = nextBest?.status === 'ready'
      ? getSessionRecommendation(features, { ...productivity, optimalSessionLength: nextBest.best.plannedDuration })
      : getSessionRecommendation(features, productivity);

    // ── Assemble response ──────────────────────────
    res.json({
      success: true,

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
        dominantCategory,
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
    });
  } catch (error) {
    console.error('[Insights] Full insights error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/insights/predict (legacy)
// ────────────────────────────────────────────────────
exports.predictDistraction = async (req, res) => {
  try {
    const userId = req.user._id;
    // Optional ?plannedDuration= lets a client preview a specific plan
    const plannedDuration = parseInt(req.query.plannedDuration) || undefined;
    const [features, prediction, breakdown, productivity] = await Promise.all([
      computeUserFeatures(userId, 7, req.query.tz),
      forecastForUser(userId, { timezone: req.query.tz, plannedDuration }),
      getDistractionBreakdown(userId, 7),
      getProductivityWindows(userId, 30, req.query.tz),
    ]);
    const sessionRec = getSessionRecommendation(features, productivity);

    const topFeatures = toLegacyTopFeatures(prediction.reasons);

    res.json({
      success: true,
      prediction: {
        ...toClientPrediction(prediction),
        distractionRisk: prediction.riskLevel,
        distractionScore: features.distractionScore,
        breakdown,
        topFeatures,
      },
      recommendations: {
        ...sessionRec,
        tips: topFeatures.map((f) => f.explanation),
      },
      features,
    });
  } catch (error) {
    console.error('[Insights] Predict error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/insights/analytics
// ────────────────────────────────────────────────────
exports.getAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;
    const { days = 7 } = req.query;

    const [topSites, trends] = await Promise.all([
      getTopSites(userId, parseInt(days)),
      getTrendAnalytics(userId, parseInt(days)),
    ]);

    res.json({
      success: true,
      analytics: {
        topSites,
        dailyDistractionTrend: trends.distractionTrend,
        focusTrend: trends.focusTrend,
      },
    });
  } catch (error) {
    console.error('[Insights] Analytics error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// POST /api/insights/browsing/log
// ────────────────────────────────────────────────────
exports.logBrowsing = async (req, res) => {
  try {
    const userId = req.user._id;
    const { website, fullUrl, duration, wasBlocked, wasUnlocked, category, sessionId } = req.body;

    if (!website) {
      return res.status(400).json({ success: false, message: 'website is required' });
    }

    const log = await BrowsingLog.create({
      userId,
      website: website.toLowerCase(),
      fullUrl,
      duration: duration || 0,
      wasBlocked: wasBlocked || false,
      wasUnlocked: wasUnlocked || false,
      category: category || 'other',
      sessionId: sessionId || null,
      timestamp: new Date(),
    });

    if (wasBlocked && sessionId) {
      await FocusSession.findByIdAndUpdate(sessionId, {
        $inc: { distractionAttempts: 1 },
      });
    }

    res.status(201).json({ success: true, log });
  } catch (error) {
    console.error('[Browsing] Log error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/insights/weekly-report
// ────────────────────────────────────────────────────
exports.downloadWeeklyReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const sessions = await FocusSession.find({
      userId,
      startTime: { $gte: since },
      status: 'completed',
    }).sort({ startTime: -1 });

    let csv = 'Date,Duration (minutes),Coins Earned,Distraction Attempts,Tab Switches,Interruptions,Live Focus Status,Predicted Success %,Succeeded\n';

    sessions.forEach((session) => {
      const date = session.startTime.toISOString().split('T')[0];
      const predicted = session.predictedSuccessProb == null ? '' : Math.round(session.predictedSuccessProb * 100);
      const succeeded = session.actualSuccess == null ? '' : session.actualSuccess ? 'yes' : 'no';
      csv += `${date},${session.duration || 0},${session.coinsEarned || 0},${session.distractionAttempts || 0},${session.tabSwitches || 0},${session.interruptions || 0},${session.mlStatus || 'low'},${predicted},${succeeded}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Weekly_Productivity_Report.csv"');
    res.status(200).send(csv);
  } catch (error) {
    console.error('[Insights] Weekly Report error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ═══════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════

function _getDominantCategory(topSites) {
  if (!topSites || topSites.length === 0) return 'other';
  // The site with the most duration
  return topSites[0]?.category || 'other';
}

/**
 * Precision / recall / F1 for each class, from a confusion matrix
 * (rows = actual, columns = predicted).
 */
function _perClassMetrics(cm, classNames) {
  const round = (x) => Math.round(x * 10000) / 10000;
  return classNames.map((name, k) => {
    const tp = cm[k][k];
    const predicted = cm.reduce((sum, row) => sum + row[k], 0);
    const actual = cm[k].reduce((a, b) => a + b, 0);
    const precision = predicted ? tp / predicted : 0;
    const recall = actual ? tp / actual : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { class: name, precision: round(precision), recall: round(recall), f1: round(f1), support: actual };
  });
}

// ────────────────────────────────────────────────────
// GET /api/insights/model
// Model transparency: how the model was evaluated, and how the predictions
// stored at session start have held up against real outcomes since.
// ────────────────────────────────────────────────────
exports.getModelInfo = async (req, res) => {
  try {
    const state = getModelState();
    const [realSessions, newSinceTraining, liveAccuracy] = await Promise.all([
      countRealSessions(),
      state.trainedAt ? countRealSessions(new Date(state.trainedAt)) : null,
      getLiveAccuracy(),
    ]);

    const report = getTrainingReport();
    const trainedReport = report?.status === 'trained' ? report : null;

    res.json({
      success: true,
      // 'model' = trained model in use (state.kind says which); 'baseline' = each user's past success rate
      source: state.ready ? 'model' : 'baseline',
      modelInfo: getModelInfo(),
      state: {
        ...state,
        status: state.ready ? 'ready' : 'learning',
        realSessions,
        newSinceTraining,
        autoRetrainAfter: AUTO_RETRAIN_NEW_SESSIONS,
      },
      report,
      perClass: trainedReport ? _perClassMetrics(trainedReport.metrics.confusion_matrix, trainedReport.class_names) : null,
      // The training report's importances when it has them, else computed from the exported model JSON
      featureImportances: trainedReport?.feature_importances
        ? { source: 'training_report', values: trainedReport.feature_importances }
        : { source: 'model_json', values: computeFeatureImportances() },
      liveAccuracy,
    });
  } catch (error) {
    console.error('[Insights] Model info error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/insights/heatmap
// ────────────────────────────────────────────────────
exports.getHeatmap = async (req, res) => {
  try {
    const userId = req.user._id;
    const { days = 28 } = req.query;
    const heatmap = await getProductivityHeatmap(userId, parseInt(days));
    res.json({ success: true, heatmap });
  } catch (error) {
    console.error('[Insights] Heatmap error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/insights/heatmap/yearly
// ────────────────────────────────────────────────────
exports.getYearlyHeatmapData = async (req, res) => {
  try {
    const userId = req.user._id;
    const { year } = req.query;
    const heatmap = await getYearlyHeatmap(userId, year);
    res.json({ success: true, ...heatmap });
  } catch (error) {
    console.error('[Insights] Yearly Heatmap error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/insights/recommendation — best start time × length in the next 24h
// ────────────────────────────────────────────────────
exports.getSessionRecommendation = async (req, res) => {
  try {
    const recommendation = await recommendForUser(req.user._id, { timezone: req.query.tz });
    res.json({ success: true, recommendation });
  } catch (error) {
    console.error('[Insights] Recommendation error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
