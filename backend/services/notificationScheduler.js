/**
 * Notification Scheduler — time-based reminders
 *
 * Runs whenever the user's notifications are fetched (the dashboard polls every
 * minute), so reminders work on serverless without a cron job. Each reminder is
 * de-duplicated against the last notification of the same type.
 *
 *   focus_reminder — no session yet today, after 10 AM (once per day)
 *   streak_alert   — active streak not extended today, after 6 PM (once per day)
 *   weekly_report  — the AI weekly report for last week is ready (once per week, after Sunday)
 *   scheduled_reminder — 10 minutes before a scheduled session (once each)
 *   scheduled_missed   — a scheduled session's start window passed without it starting
 */

const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendScheduledReminders, processDueSchedules } = require('./scheduleService');
const { lastCompletedWeek, getWeeklyReport } = require('./agent/weeklyReportService');

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

async function runScheduledChecks(userId, tz = 'UTC', { now = new Date() } = {}) {
  try {
    // Lazy require avoids a circular import with notificationController
    const { createNotification } = require('../controllers/notificationController');
    const today = localDate(now, tz);
    const hour = localHour(now, tz);

    const user = await User.findById(userId).select('currentStreak lastSessionDate createdAt settings.notifications');
    if (!user) return;

    // ── Scheduled sessions ──
    // Starting a due session is left to GET /api/session/active; here only
    // overdue ones are marked missed and upcoming ones reminded.
    await processDueSchedules(userId, { now, allowStart: false });
    await sendScheduledReminders(userId, now);

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
    // Once a week, after the user's week (Monday to Sunday) ends. Getting the
    // report generates it the first time (services/agent/weeklyReportService.js).
    const accountAgeMs = now - (user.createdAt || now);
    if (accountAgeMs >= 7 * DAY_MS && user.settings?.notifications?.weeklyReport !== false) {
      const week = lastCompletedWeek(now, tz);
      const last = await lastOfType(userId, 'weekly_report');
      if (!last || last.createdAt < week.end) {
        const weekly = await getWeeklyReport(userId, { timezone: tz, now });
        // 'generating': another request is writing it; the next poll notifies
        if (weekly.status === 'ready') {
          await createNotification(
            userId,
            'weekly_report',
            '📊 Your Weekly Report Is Ready',
            `${weekly.report.headline} See the full report on your dashboard.`,
            { weekStart: weekly.weekStart, sessions: weekly.facts.sessions, minutes: weekly.facts.focusMinutes, coins: weekly.facts.coinsEarned }
          );
        }
      }
    }
  } catch (err) {
    // Reminders must never break the notifications endpoint
    console.error('[Notifications] Scheduled check error:', err.message);
  }
}

module.exports = { runScheduledChecks };
