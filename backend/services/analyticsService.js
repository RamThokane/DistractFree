/**
 * Analytics Service — Behavioral Intelligence Engine
 *
 * Aggregates real user data from FocusSession, BrowsingLog, and CoinTransaction
 * collections to produce live, data-driven analytics. Nothing is hardcoded.
 *
 * Computes:
 *   - Productivity windows (best & worst hours)
 *   - High distraction hour analysis
 *   - Session performance patterns
 *   - Focus trends (7-day)
 *   - Distraction breakdown
 *   - Behavioral consistency metrics
 */

const mongoose = require('mongoose');
const FocusSession = require('../models/FocusSession');
const BrowsingLog = require('../models/BrowsingLog');
const User = require('../models/User');

// ── Time helpers ───────────────────────────────────
const HOUR_LABELS = [
  '12 AM','1 AM','2 AM','3 AM','4 AM','5 AM','6 AM','7 AM',
  '8 AM','9 AM','10 AM','11 AM','12 PM','1 PM','2 PM','3 PM',
  '4 PM','5 PM','6 PM','7 PM','8 PM','9 PM','10 PM','11 PM',
];

function hourToTimeBucket(hour) {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function formatHourRange(startHour) {
  const end = (startHour + 2) % 24;
  return `${HOUR_LABELS[startHour]} - ${HOUR_LABELS[end]}`;
}

// ═══════════════════════════════════════════════════
// PRODUCTIVITY WINDOWS
// ═══════════════════════════════════════════════════
/**
 * Analyse which hours of the day yield the best and worst focus performance.
 * Uses real session data: completion rate, distraction rate, average duration.
 */
async function getProductivityWindows(userId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const hourlySessionStats = await FocusSession.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        startTime: { $gte: since },
        status: { $in: ['completed', 'cancelled'] },
      },
    },
    {
      $group: {
        _id: { $hour: '$startTime' },
        totalSessions: { $sum: 1 },
        completedSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        totalMinutes: { $sum: '$duration' },
        totalPlanned: { $sum: '$plannedDuration' },
        totalDistractions: { $sum: '$distractionAttempts' },
        totalTabSwitches: { $sum: '$tabSwitches' },
        totalInterruptions: { $sum: '$interruptions' },
        avgDuration: { $avg: '$duration' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  if (hourlySessionStats.length === 0) {
    return {
      bestFocusHours: null,
      weakestHours: null,
      avgSessionMinutes: 0,
      optimalSessionLength: 25,
      hourlyData: [],
      hasSufficientData: false,
    };
  }

  // Compute a focus score per hour: weighted combination of completion rate,
  // inverse distraction rate, and average session length.
  const hourlyScored = hourlySessionStats.map((h) => {
    const completionRate = h.totalSessions > 0 ? h.completedSessions / h.totalSessions : 0;
    const avgDistractions = h.totalSessions > 0 ? h.totalDistractions / h.totalSessions : 0;
    const distractionPenalty = Math.min(avgDistractions / 5, 1); // normalise 0-1

    // Focus score: higher = better productivity
    const focusScore = Math.round(
      (completionRate * 50 + (1 - distractionPenalty) * 30 + Math.min(h.avgDuration / 60, 1) * 20)
    );

    return {
      hour: h._id,
      label: HOUR_LABELS[h._id],
      timeBucket: hourToTimeBucket(h._id),
      focusScore,
      completionRate: Math.round(completionRate * 100),
      sessions: h.totalSessions,
      avgMinutes: Math.round(h.avgDuration || 0),
      avgDistractions: Math.round(avgDistractions * 10) / 10,
      totalMinutes: h.totalMinutes,
    };
  });

  // Sort by focusScore to find best/worst
  const sorted = [...hourlyScored].sort((a, b) => b.focusScore - a.focusScore);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  // Overall averages
  const totalCompleted = hourlySessionStats.reduce((s, h) => s + h.completedSessions, 0);
  const totalMin = hourlySessionStats.reduce((s, h) => s + h.totalMinutes, 0);
  const avgSessionMinutes = totalCompleted > 0 ? Math.round(totalMin / totalCompleted) : 0;

  // Optimal session length: find the duration range where completion rate is highest
  const completedSessions = await FocusSession.find({
    userId: new mongoose.Types.ObjectId(userId),
    startTime: { $gte: since },
    status: 'completed',
  }).select('duration distractionAttempts');

  let optimalSessionLength = 25;
  if (completedSessions.length >= 3) {
    // Sessions with low distraction attempts are "successful"
    const successful = completedSessions.filter((s) => s.distractionAttempts <= 1);
    if (successful.length > 0) {
      const avgSuccessful = successful.reduce((s, x) => s + x.duration, 0) / successful.length;
      optimalSessionLength = Math.round(avgSuccessful / 5) * 5; // round to nearest 5
      optimalSessionLength = Math.max(10, Math.min(90, optimalSessionLength));
    }
  }

  return {
    bestFocusHours: best ? formatHourRange(best.hour) : null,
    bestFocusBucket: best ? best.timeBucket : null,
    bestCompletionRate: best ? best.completionRate : 0,
    weakestHours: worst ? formatHourRange(worst.hour) : null,
    weakestBucket: worst ? worst.timeBucket : null,
    weakestCompletionRate: worst ? worst.completionRate : 0,
    avgSessionMinutes,
    optimalSessionLength,
    hourlyData: hourlyScored,
    hasSufficientData: hourlySessionStats.length >= 2,
  };
}

// ═══════════════════════════════════════════════════
// HIGH DISTRACTION HOURS
// ═══════════════════════════════════════════════════
/**
 * Identify time windows with the highest distraction risk based on real data.
 */
async function getHighDistractionHours(userId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Aggregate blocked-site attempts by hour
  const hourlyBlocked = await BrowsingLog.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: since },
        wasBlocked: true,
      },
    },
    {
      $group: {
        _id: { $hour: '$timestamp' },
        blockedAttempts: { $sum: 1 },
        unlockAttempts: { $sum: { $cond: ['$wasUnlocked', 1, 0] } },
      },
    },
    { $sort: { blockedAttempts: -1 } },
  ]);

  // Also check session-level distraction data by hour
  const hourlySessionDistractions = await FocusSession.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        startTime: { $gte: since },
        status: { $in: ['completed', 'cancelled'] },
      },
    },
    {
      $group: {
        _id: { $hour: '$startTime' },
        totalDistractions: { $sum: '$distractionAttempts' },
        totalTabSwitches: { $sum: '$tabSwitches' },
        cancelledSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
        },
        totalSessions: { $sum: 1 },
      },
    },
  ]);

  // Merge browsing + session data per hour and compute risk score
  const hourMap = {};
  for (let i = 0; i < 24; i++) hourMap[i] = { blocked: 0, unlocks: 0, distractions: 0, tabSwitches: 0, cancelled: 0, sessions: 0 };

  hourlyBlocked.forEach((h) => {
    hourMap[h._id].blocked = h.blockedAttempts;
    hourMap[h._id].unlocks = h.unlockAttempts;
  });

  hourlySessionDistractions.forEach((h) => {
    hourMap[h._id].distractions = h.totalDistractions;
    hourMap[h._id].tabSwitches = h.totalTabSwitches;
    hourMap[h._id].cancelled = h.cancelledSessions;
    hourMap[h._id].sessions = h.totalSessions;
  });

  // Find max values for normalisation
  const maxBlocked = Math.max(1, ...Object.values(hourMap).map((h) => h.blocked));
  const maxDistractions = Math.max(1, ...Object.values(hourMap).map((h) => h.distractions));
  const maxTabSwitches = Math.max(1, ...Object.values(hourMap).map((h) => h.tabSwitches));

  const hourlyRisk = Object.entries(hourMap)
    .map(([hour, data]) => {
      const riskScore = Math.round(
        (data.blocked / maxBlocked) * 35 +
        (data.distractions / maxDistractions) * 30 +
        (data.tabSwitches / maxTabSwitches) * 20 +
        (data.sessions > 0 ? (data.cancelled / data.sessions) * 15 : 0)
      );

      return {
        hour: parseInt(hour),
        label: HOUR_LABELS[parseInt(hour)],
        riskPercent: Math.min(100, riskScore),
        blockedAttempts: data.blocked,
        distractions: data.distractions,
        tabSwitches: data.tabSwitches,
      };
    })
    .sort((a, b) => b.riskPercent - a.riskPercent);

  // Top 4 riskiest hours
  const topRiskHours = hourlyRisk.filter((h) => h.riskPercent > 0).slice(0, 4);

  return {
    topRiskHours,
    hourlyRisk,
    peakDistractionWindow: topRiskHours.length > 0
      ? `${topRiskHours[0].label} - ${HOUR_LABELS[(topRiskHours[0].hour + 2) % 24]}`
      : null,
    hasSufficientData: hourlyBlocked.length > 0 || hourlySessionDistractions.length > 0,
  };
}

// ═══════════════════════════════════════════════════
// 7-DAY TREND ANALYTICS
// ═══════════════════════════════════════════════════
async function getTrendAnalytics(userId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Session trends
  const sessionTrend = await FocusSession.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        startTime: { $gte: since },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        totalMinutes: { $sum: '$duration' },
        totalDistractions: { $sum: '$distractionAttempts' },
        totalTabSwitches: { $sum: '$tabSwitches' },
        avgDuration: { $avg: '$duration' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Distraction trend (browsing)
  const distractionTrend = await BrowsingLog.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: since },
        wasBlocked: true,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
        attempts: { $sum: 1 },
        unlocks: { $sum: { $cond: ['$wasUnlocked', 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Fill in missing days
  const focusTrend = [];
  const distractionData = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = dayNames[d.getDay()];
    const sessionDay = sessionTrend.find((r) => r._id === dateStr);
    const distractionDay = distractionTrend.find((r) => r._id === dateStr);

    focusTrend.push({
      date: dateStr,
      day: dayName,
      focusMinutes: sessionDay?.totalMinutes || 0,
      sessions: (sessionDay?.completed || 0) + (sessionDay?.cancelled || 0),
      completed: sessionDay?.completed || 0,
      cancelled: sessionDay?.cancelled || 0,
      distractions: sessionDay?.totalDistractions || 0,
    });

    distractionData.push({
      date: dateStr,
      day: dayName,
      attempts: distractionDay?.attempts || 0,
      unlocks: distractionDay?.unlocks || 0,
    });
  }

  // Compute consistency score: ratio of days with at least one session
  const daysWithSessions = focusTrend.filter((d) => d.sessions > 0).length;
  const consistencyScore = Math.round((daysWithSessions / days) * 100);

  return {
    focusTrend,
    distractionTrend: distractionData,
    consistencyScore,
    totalFocusMinutes: focusTrend.reduce((s, d) => s + d.focusMinutes, 0),
    totalSessions: focusTrend.reduce((s, d) => s + d.sessions, 0),
    totalDistractions: distractionData.reduce((s, d) => s + d.attempts, 0),
  };
}

// ═══════════════════════════════════════════════════
// SESSION BEHAVIOR FEATURES (for ML)
// ═══════════════════════════════════════════════════
/**
 * Compute a rich feature set from the user's real session and browsing data.
 * These features feed the ML prediction and the UI simultaneously.
 */
async function computeUserFeatures(userId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const uid = new mongoose.Types.ObjectId(userId);

  const [sessions, browsingLogs, user] = await Promise.all([
    FocusSession.find({ userId: uid, startTime: { $gte: since } }).sort({ startTime: -1 }),
    BrowsingLog.find({ userId: uid, timestamp: { $gte: since } }).sort({ timestamp: -1 }),
    User.findById(userId),
  ]);

  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const cancelledSessions = sessions.filter((s) => s.status === 'cancelled');
  const totalSessions = sessions.length;

  // Session-level features
  const avgSessionDuration = completedSessions.length > 0
    ? completedSessions.reduce((s, x) => s + x.duration, 0) / completedSessions.length
    : 0;

  const completionRate = totalSessions > 0
    ? completedSessions.length / totalSessions
    : 0;

  const avgTabSwitches = totalSessions > 0
    ? sessions.reduce((s, x) => s + (x.tabSwitches || 0), 0) / totalSessions
    : 0;

  const avgInterruptions = totalSessions > 0
    ? sessions.reduce((s, x) => s + (x.interruptions || 0), 0) / totalSessions
    : 0;

  const avgDistractionAttempts = totalSessions > 0
    ? sessions.reduce((s, x) => s + (x.distractionAttempts || 0), 0) / totalSessions
    : 0;

  // Browsing-level features
  const totalBrowsing = browsingLogs.length;
  const blockedVisits = browsingLogs.filter((l) => l.wasBlocked).length;
  const unlockAttempts = browsingLogs.filter((l) => l.wasUnlocked).length;
  const blockedVisitRatio = totalBrowsing > 0 ? blockedVisits / totalBrowsing : 0;

  // Focus score: data-driven composite
  const focusScore = Math.round(
    Math.max(0, Math.min(100,
      completionRate * 40 +
      Math.max(0, (1 - avgDistractionAttempts / 5)) * 30 +
      Math.max(0, (1 - blockedVisitRatio)) * 20 +
      Math.max(0, (1 - avgTabSwitches / 10)) * 10
    ))
  );

  // Distraction score: inverse of focus
  const distractionScore = Math.round(
    Math.min(100,
      blockedVisitRatio * 40 +
      Math.min(avgDistractionAttempts / 5, 1) * 30 +
      Math.min(avgTabSwitches / 10, 1) * 20 +
      (1 - completionRate) * 10
    )
  );

  // Time-of-day for current context
  const hour = new Date().getHours();
  let timeOfDay;
  if (hour >= 5 && hour < 12) timeOfDay = 'morning';
  else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
  else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
  else timeOfDay = 'night';

  return {
    // ML features
    sessionDuration: Math.round(avgSessionDuration),
    completionRate: Math.round(completionRate * 100),
    tabSwitchCount: Math.round(avgTabSwitches * 10) / 10,
    interruptionsCount: Math.round(avgInterruptions * 10) / 10,
    blockedSiteAttempts: Math.round(avgDistractionAttempts * 10) / 10,
    unlockAttempts,
    focusScore,
    distractionScore,
    timeOfDay,
    dayOfWeek: new Date().getDay(),
    streakCount: user?.currentStreak || 0,
    goalCompletionRate: 0, // computed elsewhere if daily goal is set

    // Metadata for UI
    totalSessions,
    completedSessions: completedSessions.length,
    cancelledSessions: cancelledSessions.length,
    totalBrowsingEvents: totalBrowsing,
    blockedVisits,
    blockedVisitRatio: Math.round(blockedVisitRatio * 100),
  };
}

// ═══════════════════════════════════════════════════
// DISTRACTION BREAKDOWN (browsing-level)
// ═══════════════════════════════════════════════════
async function getDistractionBreakdown(userId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const uid = new mongoose.Types.ObjectId(userId);

  const logs = await BrowsingLog.find({ userId: uid, timestamp: { $gte: since } })
    .sort({ timestamp: -1 });

  const totalVisits = logs.length;
  const blockedVisits = logs.filter((l) => l.wasBlocked).length;
  const totalDuration = logs.reduce((s, l) => s + (l.duration || 0), 0);
  const blockedDuration = logs.filter((l) => l.wasBlocked).reduce((s, l) => s + (l.duration || 0), 0);

  // Context switches
  let switches = 0;
  for (let i = 1; i < logs.length; i++) {
    if (logs[i].wasBlocked !== logs[i - 1].wasBlocked) switches++;
  }

  return {
    visitRatio: totalVisits > 0 ? Math.round((blockedVisits / totalVisits) * 100) : 0,
    timeRatio: totalDuration > 0 ? Math.round((blockedDuration / totalDuration) * 100) : 0,
    switchRate: logs.length > 1 ? Math.round((switches / (logs.length - 1)) * 100) : 0,
    totalVisits,
    blockedVisits,
  };
}

// ═══════════════════════════════════════════════════
// TOP SITES ANALYSIS
// ═══════════════════════════════════════════════════
async function getTopSites(userId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return BrowsingLog.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), timestamp: { $gte: since } } },
    {
      $group: {
        _id: '$website',
        visits: { $sum: 1 },
        totalDuration: { $sum: '$duration' },
        blockedVisits: { $sum: { $cond: ['$wasBlocked', 1, 0] } },
        category: { $first: '$category' },
      },
    },
    { $sort: { totalDuration: -1 } },
    { $limit: 10 },
  ]);
}

// ═══════════════════════════════════════════════════
// PRODUCTIVITY HEATMAP
// ═══════════════════════════════════════════════════
/**
 * Build a day×hour productivity heatmap from real session + browsing data.
 * Returns cells for the last N days, summary cards, and best/worst windows.
 */
async function getProductivityHeatmap(userId, days = 28) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const uid = new mongoose.Types.ObjectId(userId);
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // 1. Aggregate sessions by dayOfWeek × hour
  const sessionAgg = await FocusSession.aggregate([
    { $match: { userId: uid, startTime: { $gte: since }, status: { $in: ['completed', 'cancelled'] } } },
    {
      $group: {
        _id: { day: { $dayOfWeek: '$startTime' }, hour: { $hour: '$startTime' } },
        totalMinutes: { $sum: '$duration' },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        totalSessions: { $sum: 1 },
        distractions: { $sum: '$distractionAttempts' },
        tabSwitches: { $sum: '$tabSwitches' },
        focusedCount: { $sum: { $cond: [{ $eq: ['$mlStatus', 'Focused'] }, 1, 0] } },
        distractedCount: { $sum: { $cond: [{ $eq: ['$mlStatus', 'Distracted'] }, 1, 0] } },
      },
    },
  ]);

  // 2. Aggregate blocked-site attempts by dayOfWeek × hour
  const browsingAgg = await BrowsingLog.aggregate([
    { $match: { userId: uid, timestamp: { $gte: since }, wasBlocked: true } },
    {
      $group: {
        _id: { day: { $dayOfWeek: '$timestamp' }, hour: { $hour: '$timestamp' } },
        blockedAttempts: { $sum: 1 },
      },
    },
  ]);

  // 3. Build lookup maps
  const sessionMap = {};
  sessionAgg.forEach((r) => { sessionMap[`${r._id.day}-${r._id.hour}`] = r; });
  const browsingMap = {};
  browsingAgg.forEach((r) => { browsingMap[`${r._id.day}-${r._id.hour}`] = r; });

  // 4. Normalisation: find max values across all cells
  const allMinutes = sessionAgg.map((r) => r.totalMinutes);
  const allDistractions = sessionAgg.map((r) => r.distractions);
  const allBlocked = browsingAgg.map((r) => r.blockedAttempts);
  const maxMinutes = Math.max(1, ...allMinutes, 1);
  const maxDistractions = Math.max(1, ...allDistractions, 1);
  const maxBlocked = Math.max(1, ...allBlocked, 1);

  // 5. Build cells (7 days × 24 hours = 168 cells)
  const cells = [];
  let bestCell = null, worstCell = null;
  let highestDistraction = null;
  const daySummary = {};  // dayIndex -> { score, distraction, sessions }
  const hourSummary = {}; // hour -> { score, distraction, sessions }

  for (let dayIdx = 1; dayIdx <= 7; dayIdx++) { // MongoDB $dayOfWeek: 1=Sun..7=Sat
    const dayName = DAY_NAMES[dayIdx - 1];
    if (!daySummary[dayName]) daySummary[dayName] = { totalScore: 0, totalDistraction: 0, sessions: 0, cells: 0 };

    for (let hour = 0; hour < 24; hour++) {
      const key = `${dayIdx}-${hour}`;
      const s = sessionMap[key];
      const b = browsingMap[key];

      const minutes = s?.totalMinutes || 0;
      const completed = s?.completed || 0;
      const totalSess = s?.totalSessions || 0;
      const distractions = s?.distractions || 0;
      const tabSwitches = s?.tabSwitches || 0;
      const blocked = b?.blockedAttempts || 0;
      const focused = s?.focusedCount || 0;
      const distracted = s?.distractedCount || 0;

      // Productivity score (0-100): weighted composite
      const completionRate = totalSess > 0 ? completed / totalSess : 0;
      const tabPenalty = totalSess > 0 ? Math.min((tabSwitches / totalSess) / 10, 1) : 0;
      const distractionPenalty = Math.min(distractions / maxDistractions, 1);
      const blockedPenalty = Math.min(blocked / maxBlocked, 1);
      const durationBonus = Math.min(minutes / maxMinutes, 1);
      const mlBonus = totalSess > 0 ? (focused - distracted) / totalSess : 0;

      let score = 0;
      if (totalSess > 0 || blocked > 0) {
        score = Math.round(Math.max(0, Math.min(100,
          completionRate * 35 +
          (1 - distractionPenalty) * 20 +
          (1 - tabPenalty) * 10 +
          (1 - blockedPenalty) * 10 +
          durationBonus * 15 +
          Math.max(0, mlBonus) * 10
        )));
      }

      // Distraction intensity (0-100)
      let distractionIntensity = 0;
      if (totalSess > 0 || blocked > 0) {
        distractionIntensity = Math.round(Math.min(100,
          distractionPenalty * 35 +
          blockedPenalty * 35 +
          tabPenalty * 20 +
          (1 - completionRate) * 10
        ));
      }

      const cell = {
        day: dayName,
        dayIndex: dayIdx,
        hour,
        hourLabel: HOUR_LABELS[hour],
        score,
        distraction: distractionIntensity,
        completedSessions: completed,
        totalSessions: totalSess,
        focusMinutes: minutes,
        blockedAttempts: blocked,
        hasData: totalSess > 0 || blocked > 0,
      };
      cells.push(cell);

      if (cell.hasData) {
        if (!bestCell || score > bestCell.score) bestCell = cell;
        if (!worstCell || (score < worstCell.score && score > 0)) worstCell = cell;
        if (!highestDistraction || distractionIntensity > highestDistraction.distraction) highestDistraction = cell;

        daySummary[dayName].totalScore += score;
        daySummary[dayName].totalDistraction += distractionIntensity;
        daySummary[dayName].sessions += totalSess;
        daySummary[dayName].cells += 1;

        if (!hourSummary[hour]) hourSummary[hour] = { totalScore: 0, totalDistraction: 0, sessions: 0, cells: 0 };
        hourSummary[hour].totalScore += score;
        hourSummary[hour].totalDistraction += distractionIntensity;
        hourSummary[hour].sessions += totalSess;
        hourSummary[hour].cells += 1;
      }
    }
  }

  // 6. Compute best/worst day
  const dayEntries = Object.entries(daySummary)
    .filter(([, v]) => v.cells > 0)
    .map(([day, v]) => ({ day, avgScore: Math.round(v.totalScore / v.cells), avgDistraction: Math.round(v.totalDistraction / v.cells), sessions: v.sessions }));
  dayEntries.sort((a, b) => b.avgScore - a.avgScore);
  const bestDay = dayEntries[0] || null;
  const worstDay = dayEntries[dayEntries.length - 1] || null;
  const highestDistractionDay = [...dayEntries].sort((a, b) => b.avgDistraction - a.avgDistraction)[0] || null;

  // 7. Compute best/worst hour
  const hourEntries = Object.entries(hourSummary)
    .filter(([, v]) => v.cells > 0)
    .map(([h, v]) => ({ hour: parseInt(h), label: HOUR_LABELS[parseInt(h)], avgScore: Math.round(v.totalScore / v.cells), avgDistraction: Math.round(v.totalDistraction / v.cells), sessions: v.sessions }));
  hourEntries.sort((a, b) => b.avgScore - a.avgScore);
  const bestHour = hourEntries[0] || null;
  const worstHour = hourEntries[hourEntries.length - 1] || null;

  // 8. Data coverage
  const cellsWithData = cells.filter((c) => c.hasData).length;
  const coverage = Math.round((cellsWithData / 168) * 100);

  return {
    cells,
    bestDay: bestDay?.day || null,
    bestDayScore: bestDay?.avgScore || 0,
    worstDay: worstDay?.day || null,
    worstDayScore: worstDay?.avgScore || 0,
    highestDistractionDay: highestDistractionDay?.day || null,
    bestHour: bestHour ? `${bestHour.label} - ${HOUR_LABELS[(bestHour.hour + 2) % 24]}` : null,
    bestHourScore: bestHour?.avgScore || 0,
    worstHour: worstHour ? `${worstHour.label} - ${HOUR_LABELS[(worstHour.hour + 2) % 24]}` : null,
    worstHourScore: worstHour?.avgScore || 0,
    coverage,
    dateRange: `${since.toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`,
    hasSufficientData: cellsWithData >= 3,
  };
}

// ═══════════════════════════════════════════════════
// YEARLY PRODUCTIVITY HEATMAP
// ═══════════════════════════════════════════════════
async function getYearlyHeatmap(userId, year) {
  const uid = new mongoose.Types.ObjectId(userId);
  const targetYear = parseInt(year) || new Date().getFullYear();
  const startOfYear = new Date(Date.UTC(targetYear, 0, 1));
  const endOfYear = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999));

  // 1. Fetch data for the entire year
  const [sessions, logs] = await Promise.all([
    FocusSession.find({
      userId: uid,
      startTime: { $gte: startOfYear, $lte: endOfYear },
    }).select('startTime duration status distractionAttempts tabSwitches mlStatus'),
    BrowsingLog.find({
      userId: uid,
      timestamp: { $gte: startOfYear, $lte: endOfYear },
      wasBlocked: true,
    }).select('timestamp'),
  ]);

  // 2. Build day map for the entire year
  const dayMap = {};
  
  // Helper to get YYYY-MM-DD
  const toDateStr = (date) => {
    return date.toISOString().split('T')[0];
  };

  sessions.forEach(s => {
    if (!s.startTime) return;
    const dStr = toDateStr(s.startTime);
    if (!dayMap[dStr]) {
      dayMap[dStr] = { focusMinutes: 0, completedSessions: 0, distractions: 0, blockedAttempts: 0, tabSwitches: 0, totalSessions: 0, mlScore: 0 };
    }
    
    dayMap[dStr].totalSessions += 1;
    if (s.status === 'completed') {
      dayMap[dStr].completedSessions += 1;
    }
    dayMap[dStr].focusMinutes += (s.duration || 0);
    dayMap[dStr].distractions += (s.distractionAttempts || 0);
    dayMap[dStr].tabSwitches += (s.tabSwitches || 0);
    
    if (s.mlStatus === 'Focused') dayMap[dStr].mlScore += 1;
    else if (s.mlStatus === 'Distracted') dayMap[dStr].mlScore -= 1;
  });

  logs.forEach(l => {
    if (!l.timestamp) return;
    const dStr = toDateStr(l.timestamp);
    if (!dayMap[dStr]) {
      dayMap[dStr] = { focusMinutes: 0, completedSessions: 0, distractions: 0, blockedAttempts: 0, tabSwitches: 0, totalSessions: 0, mlScore: 0 };
    }
    dayMap[dStr].blockedAttempts += 1;
  });

  // 3. Normalize values
  let maxMinutes = 1, maxDistractions = 1, maxBlocked = 1, maxSessions = 1;
  Object.values(dayMap).forEach(d => {
    if (d.focusMinutes > maxMinutes) maxMinutes = d.focusMinutes;
    if (d.distractions > maxDistractions) maxDistractions = d.distractions;
    if (d.blockedAttempts > maxBlocked) maxBlocked = d.blockedAttempts;
    if (d.totalSessions > maxSessions) maxSessions = d.totalSessions;
  });

  // 4. Generate cells for all days in the year
  const cells = [];
  let currentDay = new Date(startOfYear);
  
  let bestDayObj = null;
  let worstDayObj = null;
  let highestDistractionObj = null;

  const monthScores = {};
  const weekScores = {};

  while (currentDay <= endOfYear) {
    const dateStr = toDateStr(currentDay);
    const d = dayMap[dateStr];
    
    let score = 0;
    let distractionScore = 0;
    let hasData = false;

    if (d) {
      hasData = true;
      const completionRate = d.totalSessions > 0 ? d.completedSessions / d.totalSessions : 0;
      const distPenalty = Math.min(d.distractions / maxDistractions, 1);
      const blockedPenalty = Math.min(d.blockedAttempts / maxBlocked, 1);
      const durationBonus = Math.min(d.focusMinutes / maxMinutes, 1);
      
      score = Math.round(
        completionRate * 35 +
        (1 - distPenalty) * 20 +
        (1 - blockedPenalty) * 20 +
        durationBonus * 25
      );
      
      score = Math.max(0, Math.min(100, score));

      distractionScore = Math.round(
        distPenalty * 40 +
        blockedPenalty * 40 +
        (1 - completionRate) * 20
      );
      distractionScore = Math.min(100, distractionScore);
    }

    const cell = {
      date: dateStr,
      score: hasData ? score : 0,
      focusMinutes: d?.focusMinutes || 0,
      completedSessions: d?.completedSessions || 0,
      distractions: d?.distractions || 0,
      blockedAttempts: d?.blockedAttempts || 0,
      distractionScore: hasData ? distractionScore : 0,
      hasData
    };
    
    cells.push(cell);

    if (hasData) {
      if (!bestDayObj || score > bestDayObj.score) bestDayObj = cell;
      if (!worstDayObj || (score < worstDayObj.score)) worstDayObj = cell;
      if (!highestDistractionObj || distractionScore > highestDistractionObj.distractionScore) highestDistractionObj = cell;

      const month = currentDay.toLocaleString('default', { month: 'long' });
      const weekNum = getWeekNumber(currentDay);
      const weekLabel = `Week ${weekNum}`;

      if (!monthScores[month]) monthScores[month] = { score: 0, days: 0 };
      monthScores[month].score += score;
      monthScores[month].days += 1;

      if (!weekScores[weekLabel]) weekScores[weekLabel] = { score: 0, days: 0 };
      weekScores[weekLabel].score += score;
      weekScores[weekLabel].days += 1;
    }

    currentDay.setDate(currentDay.getDate() + 1);
  }

  // 5. Calculate summary metrics
  let bestMonth = null, bestWeek = null;
  let highestMonthScore = -1, highestWeekScore = -1;

  for (const [month, data] of Object.entries(monthScores)) {
    const avg = data.score / data.days;
    if (avg > highestMonthScore) {
      highestMonthScore = avg;
      bestMonth = month;
    }
  }

  for (const [week, data] of Object.entries(weekScores)) {
    const avg = data.score / data.days;
    if (avg > highestWeekScore) {
      highestWeekScore = avg;
      bestWeek = week;
    }
  }

  const daysWithData = cells.filter(c => c.hasData).length;
  const coverage = Math.round((daysWithData / cells.length) * 100);
  
  // Calculate longest streak of days with data
  let longestStreak = 0;
  let currentStreak = 0;
  for (const cell of cells) {
    if (cell.hasData) {
      currentStreak++;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  // Format most productive / highest distraction day
  const mostProductiveDayStr = bestDayObj ? new Date(bestDayObj.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : null;
  const highestDistractionDayStr = highestDistractionObj ? new Date(highestDistractionObj.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : null;

  return {
    year: targetYear,
    coverage,
    bestMonth,
    bestWeek,
    mostProductiveDay: mostProductiveDayStr,
    highestDistractionDay: highestDistractionDayStr,
    longestStreak,
    cells
  };
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
  return weekNo;
}

module.exports = {
  getProductivityWindows,
  getHighDistractionHours,
  getTrendAnalytics,
  computeUserFeatures,
  getDistractionBreakdown,
  getTopSites,
  getProductivityHeatmap,
  getYearlyHeatmap,
};
