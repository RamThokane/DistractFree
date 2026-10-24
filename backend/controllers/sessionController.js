const mongoose = require('mongoose');
const FocusSession = require('../models/FocusSession');
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const { calculateCoins } = require('../utils/coinCalculator');
const { createNotification } = require('./notificationController');
const { isSessionSuccess } = require('../ml/target');
const { retrainFromAllSessions } = require('../ml/nodeTrainer');
const { refreshFromDb } = require('../ml/activeModel');
const { liveFocusStatus } = require('../utils/liveFocusStatus');
const {
  toClientPrediction,
  storedSessionPrediction,
} = require('../services/predictionService');
const { safePredict, createFocusSession } = require('../services/focusSessionService');
const { processDueSchedules, scheduleSummary } = require('../services/scheduleService');
const { buildDashboard } = require('../services/dashboardService');
const { computeStreak, streakAfterCompletion, resolveTimezone } = require('../services/streakService');
const { localDayNumber, dayFromNumber, zonedTimeToUtc } = require('../utils/timezone');
const { goalMinutesFor } = require('../utils/dailyGoal');

// Strict mode: the session can't be ended before its planned time. A little
// slack for the extension or website ending it on its own clock.
const STRICT_END_SLACK_MS = 15 * 1000;

// ────────────────────────────────────────────────────
// POST /api/session/start
// ────────────────────────────────────────────────────
exports.startSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const { plannedDuration, timezone } = req.body; // minutes, IANA timezone

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
        serverTime: new Date().toISOString(),
        session: activeSession,
      });
    }

    const { session, prediction } = await createFocusSession({ userId, plannedDuration, timezone });

    res.status(201).json({
      success: true,
      serverTime: new Date().toISOString(),
      session,
      prediction: prediction ? toClientPrediction(prediction) : null,
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

    const plannedEnd = new Date(session.startTime).getTime() + session.plannedDuration * 60000;
    if (req.user.settings?.strictMode && Date.now() < plannedEnd - STRICT_END_SLACK_MS) {
      return res.status(403).json({
        success: false,
        code: 'STRICT_SESSION_LOCKED',
        message: 'Strict mode is on, so this session can’t be ended early. It ends on its own when the timer runs out.',
      });
    }

    session.endTime = new Date();
    const actualMinutes = Math.round((session.endTime - session.startTime) / (1000 * 60));
    session.duration = Math.min(actualMinutes, session.plannedDuration);

    if (cancelled) {
      session.status = 'cancelled';
      session.coinsEarned = 0;
    } else {
      session.status = 'completed';

      // Calculate coins — the streak bonus uses the streak as it stood before this
      // session, counted in the user's timezone from their completed sessions
      const user = await User.findById(userId);
      const streakBefore = await computeStreak(userId, session.timezone, { excludeSessionId: session._id });
      const { baseCoins, streakMultiplier, distractionPenalty, totalCoins } = calculateCoins(
        session.duration,
        streakBefore.current,
        session.distractionAttempts
      );

      const afterStreak = Math.round(baseCoins * streakMultiplier);
      const lostCoins = afterStreak - totalCoins;

      session.coinsEarned = totalCoins;

      // Credit coins — add total (after penalty) to user balance
      const preEarnBalance = user.focusCoins;
      user.focusCoins += totalCoins;
      user.currentStreak = streakAfterCompletion(streakBefore);
      user.longestStreak = Math.max(user.longestStreak || 0, streakBefore.longest, user.currentStreak);
      user.lastSessionDate = session.endTime;
      await user.save();

      // Record transaction — one entry for gross earned, one for penalty deducted
      if (afterStreak > 0) {
        await CoinTransaction.create({
          userId,
          type: 'earned',
          amount: afterStreak,
          balanceAfter: preEarnBalance + afterStreak, // Balance after earning (before penalty)
          description: `Completed ${session.duration}-min focus session (base: ${baseCoins}, streak: x${streakMultiplier})`,
          sessionId: session._id,
        });

        if (lostCoins > 0) {
          await CoinTransaction.create({
            userId,
            type: 'penalty',
            amount: -lostCoins,
            balanceAfter: user.focusCoins, // Final balance after penalty
            description: `Distraction penalty (-${Math.round(distractionPenalty * 100)}%)`,
            sessionId: session._id,
          });
        }
      }

        // Notification: session complete
        await createNotification(
          userId,
          'session_complete',
          '✅ Focus Session Complete!',
          `Great work! You focused for ${session.duration} minutes and earned ${totalCoins} Focus Coins.`,
          { duration: session.duration, coins: totalCoins }
        );

      // Daily goal reached — only on the session that crosses the goal
      const goal = goalMinutesFor(user);
      if (goal > 0) {
        // Start of the user's local day (not the server's)
        const tz = streakBefore.timezone;
        const today = dayFromNumber(localDayNumber(session.endTime, tz));
        const dayStart = zonedTimeToUtc({ year: today.year, month: today.month, day: today.day, hour: 0, minute: 0 }, tz);
        const [todayAgg] = await FocusSession.aggregate([
          { $match: { userId: session.userId, status: 'completed', startTime: { $gte: dayStart }, _id: { $ne: session._id } } },
          { $group: { _id: null, minutes: { $sum: '$duration' } } },
        ]);
        const before = todayAgg?.minutes || 0;
        if (before < goal && before + session.duration >= goal) {
          await createNotification(
            userId,
            'daily_goal',
            '🎯 Daily Goal Reached!',
            `You hit your ${goal}-minute focus goal for today. Excellent work!`,
            { goal, minutes: before + session.duration }
          );
        }
      }

      // Streak milestone notifications
      const streakMilestones = [3, 7, 14, 21, 30, 50, 100];
      if (streakMilestones.includes(user.currentStreak)) {
        await createNotification(
          userId,
          'streak_milestone',
          `🔥 ${user.currentStreak}-Day Streak!`,
          `Amazing! You've maintained a ${user.currentStreak}-day focus streak. Keep it going!`,
          { streak: user.currentStreak }
        );
      }
    }

    // Record what actually happened next to the prediction made at start
    session.actualSuccess = isSessionSuccess(session) === 1;
    await session.save();

    // Strict mode lasts one session: the user turns it on again when they want it
    const strictTurnedOff = (await User.updateOne(
      { _id: userId, 'settings.strictMode': true },
      { $set: { 'settings.strictMode': false } }
    )).modifiedCount > 0;

    // Learning loop: every ended session (completed or cancelled) retrains the
    // model on all real sessions, then this instance switches to it. Runs
    // before the response because serverless functions may stop right after
    // it; training takes milliseconds. Never fails the request.
    if (process.env.ML_AUTO_RETRAIN !== 'false' && session.source !== 'simulated') {
      const learned = await retrainFromAllSessions({ trigger: 'session_end' });
      if (learned.trained) await refreshFromDb({ force: true });
    }

    res.json({
      success: true,
      session,
      strictModeTurnedOff: strictTurnedOff,
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

    // Update session metrics. These are running totals for the session, so
    // they only go up: a client that lost its counts can't reset them.
    const total = (current, incoming) => {
      const n = Number(incoming);
      return Number.isFinite(n) && n >= 0 ? Math.max(current || 0, Math.floor(n)) : current;
    };
    if (tabSwitches !== undefined) session.tabSwitches = total(session.tabSwitches, tabSwitches);
    if (interruptions !== undefined) session.interruptions = total(session.interruptions, interruptions);
    if (blockAttempts !== undefined) session.distractionAttempts = total(session.distractionAttempts, blockAttempts);

    // Live status is a plain rule over this session's counts so far — not the model
    session.mlStatus = liveFocusStatus({
      tabSwitches: session.tabSwitches,
      interruptions: session.interruptions,
      blockAttempts: session.distractionAttempts,
    });
    await session.save();

    res.json({
      success: true,
      // Rule-based, from this session's counts so far
      mlStatus: session.mlStatus,
      liveStatus: session.mlStatus,
      counts: {
        tabSwitches: session.tabSwitches,
        interruptions: session.interruptions,
        blockAttempts: session.distractionAttempts,
      },
      // The model's prediction, made when the session started
      prediction: storedSessionPrediction(session),
    });
  } catch (error) {
    console.error('[Session] Live Update error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/session/active
// ────────────────────────────────────────────────────
// Also the trigger for scheduled sessions (no cron, so it works on Vercel):
// a scheduled session that is due starts here, one that was due while
// another session was running is marked missed. The extension calls this
// every minute and the website on every dashboard page, so a schedule starts
// within a minute of its time even when only one of them is open.
exports.getActiveSession = async (req, res) => {
  try {
    const userId = req.user._id;
    let autoStarted = null;
    try {
      ({ started: autoStarted } = await processDueSchedules(userId));
    } catch (error) {
      // Schedules must never break the active-session check
      console.error('[Schedule] Due check error:', error.message);
    }

    const session = await FocusSession.findOne({ userId, status: 'active' });

    res.json({
      success: true,
      serverTime: new Date().toISOString(),
      session: session || null,
      // Title/subject of the schedule this session came from, if any
      schedule: session?.scheduledSessionId ? await scheduleSummary(session.scheduledSessionId) : null,
      // True only on the request that started it
      autoStarted: Boolean(autoStarted && session && String(autoStarted._id) === String(session._id)),
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
    const userId = new mongoose.Types.ObjectId(req.user._id);

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

    // Last 7 days daily breakdown, in the user's timezone
    const statsTz = await resolveTimezone(userId, req.query.tz);
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
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime', timezone: statsTz } },
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

// ────────────────────────────────────────────────────
// GET /api/session/dashboard
// ────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const dashboard = await buildDashboard(req.user._id, req.query.tz);
    res.json({ success: true, ...dashboard });
  } catch (error) {
    console.error('[Session] Dashboard error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/session/leaderboard
// ────────────────────────────────────────────────────
exports.getLeaderboard = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const period = req.query.period === 'all' ? 'all' : 'week';

    const sessionMatch = { $expr: { $eq: ['$userId', '$$uid'] }, status: 'completed' };
    if (period === 'week') {
      sessionMatch.startTime = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    }

    // Start from users (not sessions) so everyone appears, even with 0 focus time
    const ranked = await User.aggregate([
      {
        $lookup: {
          from: FocusSession.collection.name,
          let: { uid: '$_id' },
          pipeline: [
            { $match: sessionMatch },
            { $group: { _id: null, minutes: { $sum: '$duration' }, coins: { $sum: '$coinsEarned' }, sessions: { $sum: 1 } } },
          ],
          as: 'stats',
        },
      },
      { $unwind: { path: '$stats', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: 1,
          avatar: 1,
          minutes: { $ifNull: ['$stats.minutes', 0] },
          coins: { $ifNull: ['$stats.coins', 0] },
          sessions: { $ifNull: ['$stats.sessions', 0] },
        },
      },
      { $sort: { minutes: -1, coins: -1, sessions: -1, name: 1, _id: 1 } },
    ]);

    const entries = ranked.map((u, i) => ({
      rank: i + 1,
      name: u.name || 'Anonymous',
      avatar: u.avatar || '',
      hours: Math.round((u.minutes / 60) * 10) / 10,
      coins: u.coins,
      sessions: u.sessions,
      isCurrentUser: u._id.toString() === userId,
    }));

    // Top 50, plus the current user if they rank lower
    const leaderboard = entries.slice(0, 50);
    const me = entries.find((e) => e.isCurrentUser);
    if (me && me.rank > 50) leaderboard.push(me);

    res.json({ success: true, period, leaderboard, currentUserRank: me?.rank || null, totalUsers: entries.length });
  } catch (error) {
    console.error('[Session] Leaderboard error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
