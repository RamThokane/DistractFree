/**
 * Notification Scheduler — time-based reminders
 *
 * Runs whenever the user's notifications are fetched (the dashboard polls every
 * minute), so reminders work on serverless without a cron job. Each reminder is
 * de-duplicated against the last notification of the same type.
 *
 *   focus_reminder — no session yet today, after 10 AM (once per day)
 *   streak_alert   — active streak not extended today, after 6 PM (once per day)
 *   weekly_report  — summary of the last 7 days (once per 7 days)
 */

const Notification = require('../models/Notification');
const FocusSession = require('../models/FocusSession');
const User = require('../models/User');

const DAY_MS = 24 * 60 * 60 * 1000;

function localDate(date, tz) {
  try {
    return date.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
  } catch {
    return date.toISOString().split('T')[0];
  }
}

function localHour(date, tz) {
  try {
    return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(date));
  } catch {
    return date.getUTCHours();
  }
}

async function lastOfType(userId, type) {
  return Notification.findOne({ userId, type }).sort({ createdAt: -1 }).select('createdAt');
}

async function runScheduledChecks(userId, tz = 'UTC') {
  try {
    // Lazy require avoids a circular import with notificationController
    const { createNotification } = require('../controllers/notificationController');
    const now = new Date();
    const today = localDate(now, tz);
    const hour = localHour(now, tz);

    const user = await User.findById(userId).select('currentStreak lastSessionDate createdAt');
    if (!user) return;

    const lastSessionDay = user.lastSessionDate ? localDate(user.lastSessionDate, tz) : null;
    const focusedToday = lastSessionDay === today;
    const yesterday = localDate(new Date(now.getTime() - DAY_MS), tz);

    // ── Focus reminder ──
    if (!focusedToday && hour >= 10) {
      const last = await lastOfType(userId, 'focus_reminder');
      if (!last || localDate(last.createdAt, tz) !== today) {
        await createNotification(
          userId,
          'focus_reminder',
          '⏰ Time to Focus',
          "You haven't started a focus session today. Even 25 minutes makes a difference!"
        );
      }
    }

    // ── Streak alert ──
    if (user.currentStreak > 0 && lastSessionDay === yesterday && hour >= 18) {
      const last = await lastOfType(userId, 'streak_alert');
      if (!last || localDate(last.createdAt, tz) !== today) {
        await createNotification(
          userId,
          'streak_alert',
          '🔥 Your Streak Is at Risk',
          `Complete a session before midnight to keep your ${user.currentStreak}-day streak alive.`,
          { streak: user.currentStreak }
        );
      }
    }

    // ── Weekly report ──
    const accountAgeMs = now - (user.createdAt || now);
    if (accountAgeMs >= 7 * DAY_MS) {
      const last = await lastOfType(userId, 'weekly_report');
      if (!last || now - last.createdAt >= 7 * DAY_MS) {
        const since = new Date(now.getTime() - 7 * DAY_MS);
        const sessions = await FocusSession.find({ userId, startTime: { $gte: since }, status: 'completed' })
          .select('duration coinsEarned');
        const minutes = sessions.reduce((s, x) => s + (x.duration || 0), 0);
        const coins = sessions.reduce((s, x) => s + (x.coinsEarned || 0), 0);
        await createNotification(
          userId,
          'weekly_report',
          '📊 Your Weekly Report Is Ready',
          `Last 7 days: ${sessions.length} sessions, ${minutes} minutes focused, ${coins} coins earned. Download the full PDF report from Settings.`,
          { sessions: sessions.length, minutes, coins }
        );
      }
    }
  } catch (err) {
    // Reminders must never break the notifications endpoint
    console.error('[Notifications] Scheduled check error:', err.message);
  }
}

module.exports = { runScheduledChecks };
