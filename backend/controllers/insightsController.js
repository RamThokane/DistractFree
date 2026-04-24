const BrowsingLog = require('../models/BrowsingLog');
const FocusSession = require('../models/FocusSession');
const { computeDistractionScore } = require('../utils/distractionScore');
const { predict } = require('../ml/decisionTreeModel');

// ────────────────────────────────────────────────────
// GET /api/insights/predict
// ────────────────────────────────────────────────────
exports.predictDistraction = async (req, res) => {
  try {
    const userId = req.user._id;

    // Gather recent browsing data for the user
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentLogs = await BrowsingLog.find({
      userId,
      timestamp: { $gte: oneDayAgo },
    }).sort({ timestamp: -1 });

    // Compute distraction score from browsing history
    const { score, breakdown } = computeDistractionScore(recentLogs);

    // Determine current time-of-day bucket
    const hour = new Date().getHours();
    let timeOfDay;
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
    else timeOfDay = 'night';

    // Get last completed session for context
    const lastSession = await FocusSession.findOne({
      userId,
      status: 'completed',
    }).sort({ endTime: -1 });

    // Build feature vector for ML model
    const features = {
      timeOfDay,
      websiteCategory: _dominantCategory(recentLogs),
      sessionDuration: lastSession ? lastSession.duration : 25,
      previousDistractions: lastSession ? lastSession.distractionAttempts : 0,
      focusScore: 100 - score, // inverse of distraction score
    };

    // Run prediction
    const prediction = predict(features);

    // Generate recommendations
    const recommendations = _generateRecommendations(prediction, features, score);

    res.json({
      success: true,
      prediction: {
        distractionRisk: prediction.riskLevel,
        confidence: prediction.confidence,
        distractionScore: score,
        breakdown,
      },
      recommendations,
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
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    // Top visited sites
    const topSites = await BrowsingLog.aggregate([
      { $match: { userId, timestamp: { $gte: since } } },
      {
        $group: {
          _id: '$website',
          visits: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          blockedVisits: {
            $sum: { $cond: ['$wasBlocked', 1, 0] },
          },
        },
      },
      { $sort: { totalDuration: -1 } },
      { $limit: 10 },
    ]);

    // Hourly activity heatmap
    const hourlyActivity = await BrowsingLog.aggregate([
      { $match: { userId, timestamp: { $gte: since } } },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          visits: { $sum: 1 },
          duration: { $sum: '$duration' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Category breakdown
    const categoryBreakdown = await BrowsingLog.aggregate([
      { $match: { userId, timestamp: { $gte: since } } },
      {
        $group: {
          _id: '$category',
          visits: { $sum: 1 },
          duration: { $sum: '$duration' },
        },
      },
      { $sort: { duration: -1 } },
    ]);

    // Daily distraction trend
    const dailyDistractionTrend = await BrowsingLog.aggregate([
      { $match: { userId, timestamp: { $gte: since }, wasBlocked: true } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          attempts: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      analytics: {
        topSites,
        hourlyActivity,
        categoryBreakdown,
        dailyDistractionTrend,
      },
    });
  } catch (error) {
    console.error('[Insights] Analytics error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// POST /api/browsing/log
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

    // If the visit was blocked during an active session, increment distraction attempts
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
      status: 'completed'
    }).sort({ startTime: -1 });

    let csv = 'Date,Duration (minutes),Coins Earned,Distraction Attempts,Tab Switches,Interruptions,ML Status\n';
    
    sessions.forEach(session => {
      const date = session.startTime.toISOString().split('T')[0];
      const duration = session.duration || 0;
      const coins = session.coinsEarned || 0;
      const attempts = session.distractionAttempts || 0;
      const tabSwitches = session.tabSwitches || 0;
      const interruptions = session.interruptions || 0;
      const mlStatus = session.mlStatus || 'Focused';
      
      csv += `${date},${duration},${coins},${attempts},${tabSwitches},${interruptions},${mlStatus}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Weekly_Productivity_Report.csv"');
    res.status(200).send(csv);
  } catch (error) {
    console.error('[Insights] Weekly Report error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Internal helpers ───────────────────────────────

function _dominantCategory(logs) {
  if (!logs || logs.length === 0) return 'other';

  const counts = {};
  for (const log of logs) {
    const cat = log.category || 'other';
    counts[cat] = (counts[cat] || 0) + 1;
  }

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function _generateRecommendations(prediction, features, distractionScore) {
  const recs = {
    recommendedSessionTime: 25,
    suggestedBreakTime: 5,
    tips: [],
  };

  // Adjust session time based on risk
  if (prediction.riskLevel === 'low') {
    recs.recommendedSessionTime = 50;
    recs.suggestedBreakTime = 10;
  } else if (prediction.riskLevel === 'medium') {
    recs.recommendedSessionTime = 25;
    recs.suggestedBreakTime = 5;
  } else {
    recs.recommendedSessionTime = 15;
    recs.suggestedBreakTime = 5;
  }

  // Time-of-day tips
  if (features.timeOfDay === 'evening' || features.timeOfDay === 'night') {
    recs.tips.push('Evening sessions tend to have higher distraction rates. Consider shorter blocks.');
  }

  if (distractionScore > 60) {
    recs.tips.push('Your distraction score is high. Try adding more sites to your block list.');
  }

  if (features.previousDistractions > 3) {
    recs.tips.push('You had many blocked-site visits last session. Consider a brief mindfulness break before starting.');
  }

  if (features.focusScore > 80) {
    recs.tips.push('Great focus! Try extending your next session for extra coins.');
  }

  return recs;
}
