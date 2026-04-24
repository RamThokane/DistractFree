const FocusSession = require('../models/FocusSession');
const User = require('../models/User');
const BlockedWebsite = require('../models/BlockedWebsite');
const CoinTransaction = require('../models/CoinTransaction');
const { calculateCoins } = require('../utils/coinCalculator');

// ────────────────────────────────────────────────────
// POST /api/session/start
// ────────────────────────────────────────────────────
exports.startSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const { plannedDuration } = req.body; // minutes

    if (!plannedDuration || plannedDuration < 1) {
      return res.status(400).json({
        success: false,
        message: 'plannedDuration (in minutes) is required and must be >= 1',
      });
    }

    // Ensure no active session already running
    const activeSession = await FocusSession.findOne({ userId, status: 'active' });
    if (activeSession) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active focus session',
        session: activeSession,
      });
    }

    // Snapshot of blocked sites for this session
    const blockedSites = await BlockedWebsite.find({ userId, isActive: true });
    const blockedUrls = blockedSites.map((s) => s.websiteUrl);

    const session = await FocusSession.create({
      userId,
      plannedDuration,
      startTime: new Date(),
      blockedSitesUsed: blockedUrls,
    });

    res.status(201).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('[Session] Start error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// POST /api/session/end
// ────────────────────────────────────────────────────
exports.endSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const { sessionId, cancelled = false } = req.body;

    const session = await FocusSession.findOne({ _id: sessionId, userId, status: 'active' });
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No active session found with this ID',
      });
    }

    session.endTime = new Date();
    session.duration = Math.round(
      (session.endTime - session.startTime) / (1000 * 60) // minutes
    );

    if (cancelled) {
      session.status = 'cancelled';
      session.coinsEarned = 0;
    } else {
      session.status = 'completed';

      // Calculate coins
      const user = await User.findById(userId);
      const { totalCoins, baseCoins, streakMultiplier, distractionPenalty } = calculateCoins(
        session.duration,
        user.currentStreak,
        session.distractionAttempts
      );

      session.coinsEarned = totalCoins;

      // Credit coins
      user.focusCoins += totalCoins;
      user.updateStreak();
      await user.save();

      // Record transaction
      if (totalCoins > 0) {
        await CoinTransaction.create({
          userId,
          type: 'earned',
          amount: totalCoins,
          balanceAfter: user.focusCoins,
          description: `Completed ${session.duration}-min focus session (base: ${baseCoins}, streak: x${streakMultiplier}, penalty: -${Math.round(distractionPenalty * 100)}%)`,
          sessionId: session._id,
        });
      }
    }

    await session.save();

    res.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('[Session] End error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// POST /api/session/live-update
// ────────────────────────────────────────────────────
exports.updateLiveSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const { sessionId, duration, tabSwitches, interruptions, blockAttempts } = req.body;

    const session = await FocusSession.findOne({ _id: sessionId, userId, status: 'active' });
    if (!session) {
      return res.status(404).json({ success: false, message: 'No active session found' });
    }

    // Update session metrics
    if (tabSwitches !== undefined) session.tabSwitches = tabSwitches;
    if (interruptions !== undefined) session.interruptions = interruptions;
    if (blockAttempts !== undefined) session.distractionAttempts = blockAttempts;

    // Call Python Flask ML API
    let mlPrediction = 'Focused';
    try {
      // dynamic import for fetch since we are in node 18+
      const response = await fetch('http://127.0.0.1:5001/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration: duration || 0,
          tab_switches: tabSwitches || 0,
          interruptions: interruptions || 0,
          block_attempts: blockAttempts || 0,
        }),
      });
      const data = await response.json();
      if (data.prediction) {
        mlPrediction = data.prediction;
      }
    } catch (mlError) {
      console.error('[ML API Error]:', mlError.message);
    }

    session.mlStatus = mlPrediction;
    await session.save();

    res.json({
      success: true,
      mlStatus: session.mlStatus,
    });
  } catch (error) {
    console.error('[Session] Live Update error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/session/active
// ────────────────────────────────────────────────────
exports.getActiveSession = async (req, res) => {
  try {
    const session = await FocusSession.findOne({
      userId: req.user._id,
      status: 'active',
    });

    res.json({
      success: true,
      session: session || null,
    });
  } catch (error) {
    console.error('[Session] GetActive error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/session/history
// ────────────────────────────────────────────────────
exports.getSessionHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { userId: req.user._id };
    if (status) filter.status = status;

    const [sessions, total] = await Promise.all([
      FocusSession.find(filter)
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      FocusSession.countDocuments(filter),
    ]);

    res.json({
      success: true,
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('[Session] History error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/session/stats
// ────────────────────────────────────────────────────
exports.getSessionStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await FocusSession.aggregate([
      { $match: { userId, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalMinutes: { $sum: '$duration' },
          totalCoins: { $sum: '$coinsEarned' },
          avgDuration: { $avg: '$duration' },
          totalDistractions: { $sum: '$distractionAttempts' },
        },
      },
    ]);

    // Last 7 days daily breakdown
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyStats = await FocusSession.aggregate([
      {
        $match: {
          userId,
          status: 'completed',
          startTime: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
          sessions: { $sum: 1 },
          minutes: { $sum: '$duration' },
          coins: { $sum: '$coinsEarned' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      stats: stats[0] || {
        totalSessions: 0,
        totalMinutes: 0,
        totalCoins: 0,
        avgDuration: 0,
        totalDistractions: 0,
      },
      dailyStats,
    });
  } catch (error) {
    console.error('[Session] Stats error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
