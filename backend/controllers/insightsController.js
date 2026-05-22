/**
 * Insights Controller — AI Behavioral Intelligence API
 *
 * This controller orchestrates the analytics, ML, and recommendation services
 * to deliver a comprehensive, live, data-driven insights payload.
 *
 * Endpoints:
 *   GET /api/insights/full       — Full AI insights (prediction + analytics + recommendations)
 *   GET /api/insights/predict    — ML prediction only (legacy compat)
 *   GET /api/insights/analytics  — Browsing analytics only
 *   POST /api/insights/browsing/log — Log a browsing event
 *   GET /api/insights/weekly-report — CSV export
 */

const BrowsingLog = require('../models/BrowsingLog');
const FocusSession = require('../models/FocusSession');
const { predict } = require('../ml/decisionTreeModel');
const {
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

    // Run all analytics in parallel for performance
    const [features, productivity, distraction, trends, breakdown, topSites] = await Promise.all([
      computeUserFeatures(userId, 7),
      getProductivityWindows(userId, 30),
      getHighDistractionHours(userId, 30),
      getTrendAnalytics(userId, 7),
      getDistractionBreakdown(userId, 7),
      getTopSites(userId, 7),
    ]);

    // ── ML Prediction ──────────────────────────────
    const dominantCategory = _getDominantCategory(topSites);
    const mlFeatures = {
      timeOfDay: features.timeOfDay,
      websiteCategory: dominantCategory,
      sessionDuration: features.sessionDuration || 25,
      previousDistractions: features.blockedSiteAttempts || 0,
      focusScore: features.focusScore,
    };

    const mlPrediction = predict(mlFeatures);

    // ── Confidence calibration ─────────────────────
    // Adjust confidence based on data volume
    let dataConfidenceModifier = 1.0;
    if (features.totalSessions < 3) dataConfidenceModifier = 0.5;
    else if (features.totalSessions < 10) dataConfidenceModifier = 0.75;
    else if (features.totalSessions < 20) dataConfidenceModifier = 0.9;

    const calibratedConfidence = Math.round(mlPrediction.confidence * dataConfidenceModifier);

    let confidenceLabel;
    if (calibratedConfidence >= 75) confidenceLabel = 'High Confidence';
    else if (calibratedConfidence >= 50) confidenceLabel = 'Moderate Confidence';
    else confidenceLabel = 'Low Confidence';

    // ── Top contributing features (Explainable AI) ─
    const topFeatures = _explainPrediction(features, mlPrediction.riskLevel);

    // ── Recommendations ────────────────────────────
    const recommendations = generateRecommendations(
      features, productivity, distraction, mlPrediction, trends
    );
    const sessionRec = getSessionRecommendation(features, productivity);

    // ── Model Performance (from training metrics) ──
    const modelPerformance = _getModelPerformance();

    // ── Decision path explanation ──────────────────
    const explanation = _buildExplanation(features, mlPrediction.riskLevel, topFeatures);

    // ── Assemble response ──────────────────────────
    res.json({
      success: true,

      // Prediction
      prediction: {
        riskLevel: mlPrediction.riskLevel,
        confidence: calibratedConfidence,
        confidenceLabel,
        distractionScore: features.distractionScore,
        focusScore: features.focusScore,
        classProbabilities: mlPrediction.classProbabilities,
        topFeatures,
        explanation,
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

      // Model info
      modelPerformance,

      // Meta
      dataStatus: {
        hasSessions: features.totalSessions > 0,
        hasEnoughData: features.totalSessions >= 3,
        totalSessions: features.totalSessions,
        totalBrowsingEvents: features.totalBrowsingEvents,
        dataRange: '7 days',
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
    const features = await computeUserFeatures(userId, 7);
    const topSites = await getTopSites(userId, 7);
    const dominantCategory = _getDominantCategory(topSites);

    const mlFeatures = {
      timeOfDay: features.timeOfDay,
      websiteCategory: dominantCategory,
      sessionDuration: features.sessionDuration || 25,
      previousDistractions: features.blockedSiteAttempts || 0,
      focusScore: features.focusScore,
    };

    const prediction = predict(mlFeatures);
    const breakdown = await getDistractionBreakdown(userId, 7);
    const productivity = await getProductivityWindows(userId, 30);
    const sessionRec = getSessionRecommendation(features, productivity);

    const topFeatures = _explainPrediction(features, prediction.riskLevel);

    res.json({
      success: true,
      prediction: {
        distractionRisk: prediction.riskLevel,
        confidence: prediction.confidence,
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

    let csv = 'Date,Duration (minutes),Coins Earned,Distraction Attempts,Tab Switches,Interruptions,ML Status\n';

    sessions.forEach((session) => {
      const date = session.startTime.toISOString().split('T')[0];
      csv += `${date},${session.duration || 0},${session.coinsEarned || 0},${session.distractionAttempts || 0},${session.tabSwitches || 0},${session.interruptions || 0},${session.mlStatus || 'Focused'}\n`;
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
 * Explainable AI: Identify the top features contributing to the current prediction.
 */
function _explainPrediction(features, riskLevel) {
  const explanations = [];

  // Tab switching
  if (features.tabSwitchCount > 5) {
    explanations.push({
      feature: 'Tab Switching',
      value: `${features.tabSwitchCount} avg per session`,
      impact: 'high',
      explanation: `High tab switching (${features.tabSwitchCount}/session) indicates fragmented attention.`,
    });
  } else if (features.tabSwitchCount > 2) {
    explanations.push({
      feature: 'Tab Switching',
      value: `${features.tabSwitchCount} avg per session`,
      impact: 'medium',
      explanation: `Moderate tab switching suggests occasional context breaks.`,
    });
  }

  // Blocked site attempts
  if (features.blockedSiteAttempts > 3) {
    explanations.push({
      feature: 'Blocked Site Attempts',
      value: `${features.blockedSiteAttempts} avg per session`,
      impact: 'high',
      explanation: `Repeated blocked site attempts (${features.blockedSiteAttempts}/session) drive distraction risk up.`,
    });
  } else if (features.blockedSiteAttempts > 1) {
    explanations.push({
      feature: 'Blocked Site Attempts',
      value: `${features.blockedSiteAttempts} avg per session`,
      impact: 'medium',
      explanation: `Some blocked site visits detected — manageable but worth watching.`,
    });
  }

  // Time of day
  if (features.timeOfDay === 'night') {
    explanations.push({
      feature: 'Time of Day',
      value: 'Night',
      impact: 'medium',
      explanation: 'Late-night sessions historically correlate with higher distraction rates.',
    });
  } else if (features.timeOfDay === 'evening') {
    explanations.push({
      feature: 'Time of Day',
      value: 'Evening',
      impact: 'low',
      explanation: 'Evening sessions show moderate distraction patterns in your data.',
    });
  } else if (features.timeOfDay === 'morning') {
    explanations.push({
      feature: 'Time of Day',
      value: 'Morning',
      impact: 'positive',
      explanation: 'Morning sessions typically show your best focus performance.',
    });
  }

  // Completion rate
  if (features.completionRate < 50) {
    explanations.push({
      feature: 'Completion Rate',
      value: `${features.completionRate}%`,
      impact: 'high',
      explanation: `Low completion rate (${features.completionRate}%) suggests sessions are too long or poorly timed.`,
    });
  } else if (features.completionRate >= 80) {
    explanations.push({
      feature: 'Completion Rate',
      value: `${features.completionRate}%`,
      impact: 'positive',
      explanation: `Strong completion rate (${features.completionRate}%) shows good session planning.`,
    });
  }

  // Blocked visit ratio (browsing)
  if (features.blockedVisitRatio > 20) {
    explanations.push({
      feature: 'Blocked Visit Ratio',
      value: `${features.blockedVisitRatio}%`,
      impact: 'high',
      explanation: `${features.blockedVisitRatio}% of browsing activity targets blocked sites.`,
    });
  }

  // Sort: high impact first, then medium, then positive
  const impactOrder = { high: 0, medium: 1, low: 2, positive: 3 };
  explanations.sort((a, b) => (impactOrder[a.impact] || 3) - (impactOrder[b.impact] || 3));

  return explanations.slice(0, 5);
}

/**
 * Build a human-readable decision path explanation.
 */
function _buildExplanation(features, riskLevel, topFeatures) {
  if (features.totalSessions === 0) {
    return 'No session data available yet. Complete a few focus sessions to generate AI predictions.';
  }

  if (topFeatures.length === 0) {
    return `Based on ${features.totalSessions} sessions over the past week, your overall distraction risk is ${riskLevel}.`;
  }

  const negativeFeatures = topFeatures.filter((f) => f.impact === 'high' || f.impact === 'medium');
  const positiveFeatures = topFeatures.filter((f) => f.impact === 'positive');

  let explanation = '';

  if (negativeFeatures.length > 0) {
    const factors = negativeFeatures.map((f) => f.feature.toLowerCase()).join(', ');
    explanation += `Key risk factors: ${factors}. `;
  }

  if (positiveFeatures.length > 0) {
    const factors = positiveFeatures.map((f) => f.feature.toLowerCase()).join(', ');
    explanation += `Strengths: ${factors}. `;
  }

  explanation += `Analysis based on ${features.totalSessions} sessions and ${features.totalBrowsingEvents} browsing events over 7 days.`;

  return explanation;
}

/**
 * Return the model's training performance metrics.
 * These come from the actual trained model metadata.
 */
function _getModelPerformance() {
  // Read from the model file if available
  try {
    const fs = require('fs');
    const path = require('path');
    const metaPath = path.resolve(__dirname, '..', 'ml', 'model', 'model_metadata.json');

    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      return {
        accuracy: meta.accuracy || null,
        precision: meta.precision || null,
        recall: meta.recall || null,
        f1Score: meta.f1_score || null,
        trainedAt: meta.trained_at || null,
        trainingSamples: meta.training_samples || null,
        modelType: 'Decision Tree Classifier',
      };
    }
  } catch (err) {
    // Ignore
  }

  return {
    accuracy: null,
    precision: null,
    recall: null,
    f1Score: null,
    trainedAt: null,
    trainingSamples: null,
    modelType: 'Decision Tree Classifier (Awaiting Training Data)',
  };
}

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
