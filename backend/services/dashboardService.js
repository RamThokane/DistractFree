/**
 * Dashboard Service — the numbers on the dashboard: today, streak, goal, the
 * last 7 days and a forecast for a session started now.
 *
 * Used by GET /api/session/dashboard and by the AI assistant's
 * getDashboardStats tool, so both always report the same figures.
 */

const mongoose = require('mongoose');
const FocusSession = require('../models/FocusSession');
const User = require('../models/User');
const { toClientPrediction } = require('./predictionService');
const { forecastForUser } = require('./sessionRecommender');
const { computeStreak, resolveTimezone } = require('./streakService');
const { localDayNumber, dayFromNumber, zonedTimeToUtc } = require('../utils/timezone');

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * @param {string|ObjectId} userIdInput
 * @param {string} [requestedTz] the browser's IANA timezone, if sent
 * @returns {Promise<object>} the dashboard payload (without `success`)
 */
async function buildDashboard(userIdInput, requestedTz, { now = new Date() } = {}) {
  const userId = new mongoose.Types.ObjectId(userIdInput);

  // Everything is counted in the user's local days. The server runs in UTC,
  // so without this a session at 00:30 in India landed on the previous day.
  const tz = await resolveTimezone(userId, requestedTz);
  const todayNum = localDayNumber(now, tz);
  const dayStart = (n) => {
    const d = dayFromNumber(n);
    return zonedTimeToUtc({ year: d.year, month: d.month, day: d.day, hour: 0, minute: 0 }, tz);
  };
  const dayKey = (n) => {
    const d = dayFromNumber(n);
    return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
  };
  const todayStart = dayStart(todayNum);
  const todayEnd = dayStart(todayNum + 1);

  // Today's stats
  const todayAgg = await FocusSession.aggregate([
    { $match: { userId, status: 'completed', startTime: { $gte: todayStart, $lt: todayEnd } } },
    {
      $group: {
        _id: null,
        focusMinutes: { $sum: '$duration' },
        coinsEarned: { $sum: '$coinsEarned' },
        sessions: { $sum: 1 },
        distractions: { $sum: '$distractionAttempts' },
      },
    },
  ]);

  const today = todayAgg[0] || { focusMinutes: 0, coinsEarned: 0, sessions: 0, distractions: 0 };

  // User for goal; streak computed from sessions in the user's days
  const user = await User.findById(userId);
  const streak = await computeStreak(userId, tz, { now });

  // Last 7 local days, oldest first, ending today
  const weeklyRaw = await FocusSession.aggregate([
    { $match: { userId, status: 'completed', startTime: { $gte: dayStart(todayNum - 6), $lt: todayEnd } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime', timezone: tz } },
        minutes: { $sum: '$duration' },
        coins: { $sum: '$coinsEarned' },
        distractions: { $sum: '$distractionAttempts' },
      },
    },
  ]);

  const weeklyFocusData = [];
  const distractionTrend = [];
  const coinsEarnedWeekly = [];

  for (let n = todayNum - 6; n <= todayNum; n++) {
    const found = weeklyRaw.find((r) => r._id === dayKey(n));
    const day = DAY_NAMES[dayFromNumber(n).weekday];
    const date = dayKey(n);
    weeklyFocusData.push({ day, date, minutes: found ? found.minutes : 0 });
    coinsEarnedWeekly.push({ day, date, coins: found ? found.coins : 0 });
    distractionTrend.push({ day, date, score: found ? found.distractions : 0 });
  }

  // Forward-looking: the model's estimate for a session started right now.
  // Deliberately separate from the "today" numbers above, which describe the past.
  // Same scorer as the session recommender, so the numbers agree
  const prediction = await forecastForUser(userId, { timezone: requestedTz }).catch((err) => {
    console.error('[Session] Forecast error:', err.message);
    return null;
  });
  const client = prediction ? toClientPrediction(prediction) : null;

  return {
    todayFocusMinutes: today.focusMinutes,
    coinsEarnedToday: today.coinsEarned,
    sessionsToday: today.sessions,
    currentStreak: streak.current,
    longestStreak: Math.max(user.longestStreak || 0, streak.longest),
    focusCoins: user.focusCoins,
    timezone: tz,
    nextSessionPrediction: client,
    // Compact form for the dashboard tile
    mlPrediction: client && {
      riskLevel: client.riskLevel,
      successPercent: client.successPercent,
      confidence: client.confidence,
      classProbabilities: client.classProbabilities,
      source: client.source,
      isColdStart: client.isColdStart,
    },
    dailyGoal: user.dailyGoal || { focusMinutes: 0, sessions: 0 },
    goalMinutes: user.settings?.dailyGoalMinutes || 120,
    weeklyFocusData,
    distractionTrend,
    coinsEarnedWeekly,
  };
}

module.exports = { buildDashboard };
