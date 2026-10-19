/**
 * AI weekly report — last week (Monday to Sunday, in the user's timezone).
 *
 *   1. facts: computed in code from sessions and coin transactions
 *   2. report: Gemini turns the facts into { headline, wins, slips, goal },
 *      as structured JSON, told to use only those facts. If Gemini is off,
 *      fails or returns something unusable, a plain template is used instead.
 *
 * Each week is generated once and stored (models/WeeklyReport.js). There is
 * no per-user job: it's generated the first time it's asked for after the
 * week ends (dashboard card, notifications poll or the assistant), and a
 * "generating" claim stops two requests from writing it at once. The one
 * cron job (Mondays, see sendWeeklyEmails) only covers users who asked for
 * the report by email, so it reaches them without a visit.
 */

const mongoose = require('mongoose');
const FocusSession = require('../../models/FocusSession');
const CoinTransaction = require('../../models/CoinTransaction');
const User = require('../../models/User');
const WeeklyReport = require('../../models/WeeklyReport');
const { ENDED_STATUSES, isSessionSuccess } = require('../../ml/target');
const { computeStreak, resolveTimezone } = require('../streakService');
const { generate, isConfigured } = require('./geminiClient');
const { zoneOr, localParts, zonedTimeToUtc, localDayNumber, dayFromNumber } = require('../../utils/timezone');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STALE_CLAIM_MS = 2 * 60 * 1000;
const MAX_WEEKS_BACK = 12;
const MAX_ITEM_CHARS = 220;

const pad = (n) => String(n).padStart(2, '0');
const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

// ── Weeks ──────────────────────────────────────────

const startOfDay = (n, tz) => {
  const d = dayFromNumber(n);
  return zonedTimeToUtc({ year: d.year, month: d.month, day: d.day, hour: 0, minute: 0 }, tz);
};

/** Day number of the Monday of the week containing day n. */
const mondayOf = (n) => n - ((dayFromNumber(n).weekday + 6) % 7);

/** The last full week before `now`: { startDay, start, end } (end exclusive). */
function lastCompletedWeek(now, tz) {
  const startDay = mondayOf(localDayNumber(now, tz)) - 7;
  return { startDay, start: startOfDay(startDay, tz), end: startOfDay(startDay + 7, tz) };
}

/** The week starting on a given local Monday ("YYYY-MM-DD"), or null if it isn't one. */
function weekFromDate(dateStr, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return null;
  const start = zonedTimeToUtc({ year: +m[1], month: +m[2], day: +m[3], hour: 0, minute: 0 }, tz);
  const startDay = localDayNumber(start, tz);
  if (dayFromNumber(startDay).weekday !== 1) return null;
  return { startDay, start, end: startOfDay(startDay + 7, tz) };
}

function weekLabel(startDay) {
  const fmt = (n) => {
    const d = dayFromNumber(n);
    return new Date(Date.UTC(d.year, d.month - 1, d.day)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  };
  return `${fmt(startDay)} – ${fmt(startDay + 6)}`;
}

const dayKey = (n) => {
  const d = dayFromNumber(n);
  return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
};

// ── Facts ──────────────────────────────────────────

/**
 * The week's numbers. Focus minutes count completed sessions only, as on the
 * dashboard; "went to plan" uses the ML model's success rule (ml/target.js).
 */
async function computeWeekFacts(userIdInput, week, tz, { now = new Date() } = {}) {
  const userId = new mongoose.Types.ObjectId(userIdInput);
  const prevStart = startOfDay(week.startDay - 7, tz);

  const [sessions, prevSessions, coins, user, streak] = await Promise.all([
    FocusSession.find({ userId, status: { $in: ENDED_STATUSES }, startTime: { $gte: week.start, $lt: week.end } })
      .select('startTime plannedDuration duration status distractionAttempts coinsEarned').lean(),
    FocusSession.find({ userId, status: 'completed', startTime: { $gte: prevStart, $lt: week.start } }).select('duration').lean(),
    CoinTransaction.find({ userId, createdAt: { $gte: week.start, $lt: week.end } }).select('type amount description').lean(),
    User.findById(userId).select('dailyGoal settings').lean(),
    computeStreak(userId, tz, { now }),
  ]);

  const completed = sessions.filter((s) => s.status === 'completed');
  const focusMinutes = completed.reduce((sum, s) => sum + (s.duration || 0), 0);
  const previousWeekFocusMinutes = prevSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const wentToPlan = sessions.filter((s) => isSessionSuccess(s) === 1).length;

  // Minutes per local day, Monday first
  const perDay = Array.from({ length: 7 }, (_, i) => ({
    date: dayKey(week.startDay + i),
    day: DAY_NAMES[dayFromNumber(week.startDay + i).weekday],
    focusMinutes: 0,
    sessions: 0,
  }));
  for (const s of completed) {
    const i = localDayNumber(s.startTime, tz) - week.startDay;
    if (perDay[i]) {
      perDay[i].focusMinutes += s.duration || 0;
      perDay[i].sessions += 1;
    }
  }
  const bestDay = perDay.reduce((best, d) => (d.focusMinutes > (best?.focusMinutes || 0) ? d : best), null);

  // Start hour with the most sessions that went to plan (ties: more minutes)
  const byHour = new Map();
  for (const s of sessions) {
    const h = localParts(s.startTime, tz).hour;
    const e = byHour.get(h) || { hour: h, sessions: 0, wentToPlan: 0, minutes: 0 };
    e.sessions += 1;
    e.wentToPlan += isSessionSuccess(s);
    e.minutes += s.status === 'completed' ? s.duration || 0 : 0;
    byHour.set(h, e);
  }
  const bestHour = [...byHour.values()]
    .filter((e) => e.wentToPlan > 0)
    .sort((a, b) => b.wentToPlan - a.wentToPlan || b.minutes - a.minutes)[0] || null;

  const spent = coins.filter((c) => c.amount < 0);
  const goalMinutes = user?.dailyGoal?.focusMinutes || user?.settings?.dailyGoalMinutes || 120;

  return {
    weekStart: dayKey(week.startDay),
    weekLabel: weekLabel(week.startDay),
    timezone: tz,
    focusMinutes,
    previousWeekFocusMinutes,
    changePercent: previousWeekFocusMinutes > 0 ? Math.round(((focusMinutes - previousWeekFocusMinutes) / previousWeekFocusMinutes) * 100) : null,
    sessions: sessions.length,
    completedSessions: completed.length,
    endedEarly: sessions.length - completed.length,
    wentToPlan,
    wentToPlanPercent: sessions.length ? Math.round((wentToPlan / sessions.length) * 100) : null,
    avgSessionMinutes: completed.length ? Math.round(focusMinutes / completed.length) : 0,
    daysFocused: perDay.filter((d) => d.sessions > 0).length,
    daysAtGoal: perDay.filter((d) => d.focusMinutes >= goalMinutes).length,
    dailyGoalMinutes: goalMinutes,
    bestDay: bestDay && { day: bestDay.day, date: bestDay.date, focusMinutes: bestDay.focusMinutes },
    bestStartHour: bestHour && { hour: bestHour.hour, label: hourLabel(bestHour.hour), wentToPlan: bestHour.wentToPlan, sessions: bestHour.sessions },
    blockedAttempts: sessions.reduce((sum, s) => sum + (s.distractionAttempts || 0), 0),
    coinsEarned: coins.filter((c) => c.amount > 0).reduce((sum, c) => sum + c.amount, 0),
    coinsSpent: spent.reduce((sum, c) => sum - c.amount, 0),
    coinUnlocks: spent.filter((c) => /^Unlocked\b/i.test(c.description || '')).length,
    currentStreakDays: streak.current,
    perDay,
  };
}

// ── Report text ────────────────────────────────────

const fmtMinutes = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

/** Plain report from the facts alone (Gemini off or unusable). */
function templateReport(f) {
  if (f.sessions === 0) {
    return {
      headline: `No focus sessions in the week of ${f.weekLabel}.`,
      wins: [],
      slips: ['No sessions were started last week.'],
      goal: { text: 'Start small: one 25-minute session on two days this week.', suggestedSlot: null },
    };
  }
  const wins = [];
  if (f.focusMinutes > 0) wins.push(`You focused ${fmtMinutes(f.focusMinutes)} across ${f.daysFocused} day${f.daysFocused === 1 ? '' : 's'}.`);
  if (f.changePercent !== null && f.changePercent > 0) wins.push(`That's ${f.changePercent}% more than the week before.`);
  if (f.bestDay) wins.push(`${f.bestDay.day} was your best day with ${fmtMinutes(f.bestDay.focusMinutes)}.`);

  const slips = [];
  if (f.endedEarly > 0) slips.push(`${f.endedEarly} session${f.endedEarly === 1 ? '' : 's'} ended early.`);
  if (f.coinUnlocks > 0) slips.push(`You unlocked blocked sites ${f.coinUnlocks} time${f.coinUnlocks === 1 ? '' : 's'} with coins.`);
  if (f.changePercent !== null && f.changePercent < 0) slips.push(`Focus time was down ${Math.abs(f.changePercent)}% on the week before.`);

  const slot = f.bestStartHour ? { weekday: null, hour: f.bestStartHour.hour, plannedDuration: Math.max(25, Math.min(90, Math.round(f.avgSessionMinutes / 5) * 5 || 25)) } : null;
  return {
    headline: `${fmtMinutes(f.focusMinutes)} of focus in ${f.sessions} session${f.sessions === 1 ? '' : 's'}${f.wentToPlanPercent !== null ? `, ${f.wentToPlanPercent}% went to plan` : ''}.`,
    wins: wins.slice(0, 3),
    slips: slips.slice(0, 3),
    goal: {
      text: f.daysFocused < 5 ? `Focus on ${Math.min(7, f.daysFocused + 1)} days this week${f.bestStartHour ? `, starting around ${f.bestStartHour.label}` : ''}.` : `Keep your ${f.daysFocused}-day rhythm going this week.`,
      suggestedSlot: slot,
    },
  };
}

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'One upbeat, specific sentence summing up the week (max 120 chars)' },
    wins: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'Up to 3 things that went well, each one short sentence citing a fact' },
    slips: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'Up to 3 things that slipped, kind and factual; empty if none' },
    goal: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'One concrete, achievable goal for this week' },
        suggestedSlot: {
          type: 'object',
          description: 'Optional: a session to schedule that serves the goal, based on bestStartHour / bestDay',
          properties: {
            weekday: { type: 'integer', description: '0=Sunday..6=Saturday' },
            hour: { type: 'integer', description: 'Local start hour, 0-23' },
            plannedDuration: { type: 'integer', description: 'Minutes, 15-120' },
          },
          required: ['weekday', 'hour', 'plannedDuration'],
        },
      },
      required: ['text'],
    },
  },
  required: ['headline', 'wins', 'slips', 'goal'],
};

const REPORT_INSTRUCTION = `You write the DistractFree weekly focus report for one user.
Use ONLY the facts in the JSON you are given; never invent numbers, days or times. If there were few or no sessions, say so kindly.
Tone: warm, encouraging, specific, never preachy or guilt-tripping. Plain text, no markdown or emoji.
"Went to plan" means completed with at least 90% of the planned time and at most one blocked-site attempt.
The goal is for the current week (the one after the report week): call it "this week". Keep it small and concrete.
Only add suggestedSlot when bestStartHour or bestDay supports it, and pick a weekday still ahead this week (you are told today's date).`;

const cleanText = (s) => String(s || '').replace(/[*_#`]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_ITEM_CHARS);
const intIn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/** Check and tidy the model's JSON; null if it can't be used. */
function sanitiseReport(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const headline = cleanText(raw.headline);
  const goalText = cleanText(raw.goal?.text);
  if (!headline || !goalText) return null;
  const list = (a) => (Array.isArray(a) ? a.map(cleanText).filter(Boolean).slice(0, 3) : []);
  const s = raw.goal?.suggestedSlot;
  const slot = s && intIn(s.weekday, 0, 6) && intIn(s.hour, 0, 23) && intIn(s.plannedDuration, 15, 120)
    ? { weekday: s.weekday, hour: s.hour, plannedDuration: s.plannedDuration }
    : null;
  return { headline, wins: list(raw.wins), slips: list(raw.slips), goal: { text: goalText, suggestedSlot: slot } };
}

async function writeReport(facts, { now = new Date() } = {}) {
  if (facts.sessions === 0 || !isConfigured()) return { report: templateReport(facts), source: 'template', model: null };
  try {
    const today = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: facts.timezone });
    const res = await generate({
      systemInstruction: REPORT_INSTRUCTION,
      contents: [{ role: 'user', parts: [{ text: `Today is ${today}.\nFacts for the week ${facts.weekLabel}:\n${JSON.stringify(facts)}` }] }],
      responseSchema: REPORT_SCHEMA,
      temperature: 0.5,
    });
    const report = sanitiseReport(JSON.parse(res.text));
    if (report) return { report, source: 'gemini', model: res.model };
    console.error('[WeeklyReport] Unusable model output, using the template');
  } catch (err) {
    console.error('[WeeklyReport] Gemini failed, using the template:', err.message);
  }
  return { report: templateReport(facts), source: 'template', model: null };
}

/** The next start (after now) for a { weekday, hour } slot, as an ISO string. */
function nextSlotStart(slot, tz, now = new Date()) {
  if (!slot || slot.hour == null) return null;
  const today = localDayNumber(now, tz);
  for (let i = 0; i < 8; i++) {
    const d = dayFromNumber(today + i);
    if (slot.weekday != null && d.weekday !== slot.weekday) continue;
    const at = zonedTimeToUtc({ year: d.year, month: d.month, day: d.day, hour: slot.hour, minute: 0 }, tz);
    if (at.getTime() > now.getTime() + 5 * 60 * 1000) return at.toISOString();
  }
  return null;
}

// ── Email ──────────────────────────────────────────

async function emailReport(userId, doc) {
  const user = await User.findById(userId).select('email name settings').lean();
  if (!user?.settings?.notifications?.weeklyReportEmail || doc.emailedAt) return false;
  // Claim first, so a retry never sends twice
  const claimed = await WeeklyReport.findOneAndUpdate({ _id: doc._id, emailedAt: null }, { emailedAt: new Date() });
  if (!claimed) return false;

  const { sendEmail } = require('../../utils/mailer');
  const r = doc.report;
  const f = doc.facts;
  const first = String(user.name || '').split(' ')[0] || 'there';
  const lines = [
    `Hi ${first},`, '', r.headline, '',
    `Focus time: ${fmtMinutes(f.focusMinutes)} · Sessions: ${f.sessions} · Went to plan: ${f.wentToPlanPercent ?? 0}% · Streak: ${f.currentStreakDays} days`, '',
    ...(r.wins.length ? ['What went well:', ...r.wins.map((w) => `- ${w}`), ''] : []),
    ...(r.slips.length ? ['What slipped:', ...r.slips.map((s) => `- ${s}`), ''] : []),
    `Goal for this week: ${r.goal.text}`, '',
    `See it on your dashboard: ${(process.env.CLIENT_URL || 'https://distractfree.site').split(',')[0].trim().replace(/\/+$/, '')}/dashboard`, '',
    'You get this because weekly report emails are on in Settings.',
  ];
  try {
    await sendEmail({ to: user.email, subject: `Your DistractFree week: ${f.weekLabel}`, text: lines.join('\n') });
    return true;
  } catch (err) {
    await WeeklyReport.updateOne({ _id: doc._id }, { emailedAt: null });
    console.error('[WeeklyReport] Email failed:', err.message);
    return false;
  }
}

// ── Public ─────────────────────────────────────────

function toView(doc, tz, now) {
  const report = doc.report && {
    ...doc.report,
    goal: doc.report.goal && {
      ...doc.report.goal,
      suggestedSlot: doc.report.goal.suggestedSlot && {
        ...doc.report.goal.suggestedSlot,
        startAt: nextSlotStart(doc.report.goal.suggestedSlot, tz, now),
      },
    },
  };
  return { status: 'ready', weekStart: doc.facts.weekStart, weekLabel: doc.facts.weekLabel, facts: doc.facts, report, source: doc.source };
}

/**
 * Last week's report (or the week starting on `weekStart`, "YYYY-MM-DD", a
 * Monday at most MAX_WEEKS_BACK ago), generating it if needed.
 *
 * @returns {Promise<{ status: 'ready'|'generating'|'none', ... }>}
 *   none: the account didn't exist yet that week, or the week isn't over
 */
async function getWeeklyReport(userIdInput, { timezone, weekStart, now = new Date(), sendEmail = true } = {}) {
  const userId = new mongoose.Types.ObjectId(userIdInput);
  const tz = zoneOr(timezone);
  const latest = lastCompletedWeek(now, tz);
  let week = latest;
  if (weekStart && weekStart !== 'latest') {
    week = weekFromDate(weekStart, tz);
    if (!week || week.startDay > latest.startDay || latest.startDay - week.startDay > MAX_WEEKS_BACK * 7) {
      return { status: 'none', reason: 'Pick a Monday from the last 12 weeks.' };
    }
  }

  let doc = await WeeklyReport.findOne({ userId, weekStart: week.start }).lean();
  if (doc?.status === 'ready') {
    if (sendEmail && !doc.emailedAt) await emailReport(userId, doc).catch((err) => console.error('[WeeklyReport] Email error:', err.message));
    return toView(doc, tz, now);
  }

  const user = await User.findById(userId).select('createdAt').lean();
  if (!user) return { status: 'none', reason: 'User not found' };
  if (user.createdAt && user.createdAt >= week.end) {
    return { status: 'none', reason: 'Your first weekly report arrives after your first full week.' };
  }

  // Claim the week: create it, or take over a claim that has gone stale
  if (!doc) {
    try {
      doc = (await WeeklyReport.create({ userId, weekStart: week.start, timezone: tz, status: 'generating', generatingAt: now })).toObject();
    } catch (err) {
      if (err.code !== 11000) throw err;
      doc = await WeeklyReport.findOne({ userId, weekStart: week.start }).lean();
      if (doc?.status === 'ready') return toView(doc, tz, now);
      return { status: 'generating', weekLabel: weekLabel(week.startDay) };
    }
  } else {
    const taken = await WeeklyReport.findOneAndUpdate(
      { _id: doc._id, status: 'generating', generatingAt: { $lt: new Date(now.getTime() - STALE_CLAIM_MS) } },
      { generatingAt: now },
      { new: true }
    ).lean();
    if (!taken) return { status: 'generating', weekLabel: weekLabel(week.startDay) };
    doc = taken;
  }

  try {
    const facts = await computeWeekFacts(userId, week, tz, { now });
    const { report, source, model } = await writeReport(facts, { now });
    doc = await WeeklyReport.findByIdAndUpdate(doc._id, { status: 'ready', facts, report, source, model, timezone: tz }, { new: true }).lean();
  } catch (err) {
    // Let the next request try again
    await WeeklyReport.deleteOne({ _id: doc._id, status: 'generating' }).catch(() => {});
    throw err;
  }
  if (sendEmail) await emailReport(userId, doc).catch((err) => console.error('[WeeklyReport] Email error:', err.message));
  return toView(doc, tz, now);
}

/**
 * Cron (Mondays): make sure every user who turned on weekly report emails
 * gets last week's report, even if they haven't opened the site.
 * Stops early when the time budget runs out; the next run picks up the rest.
 */
async function sendWeeklyEmails({ now = new Date(), budgetMs = 240 * 1000, limit = 500 } = {}) {
  const started = Date.now();
  const users = await User.find({ 'settings.notifications.weeklyReportEmail': true }).select('_id').limit(limit).lean();
  const result = { users: users.length, processed: 0, failed: 0 };
  for (const u of users) {
    if (Date.now() - started > budgetMs) break;
    try {
      const timezone = await resolveTimezone(u._id);
      await getWeeklyReport(u._id, { timezone, now });
      result.processed += 1;
    } catch (err) {
      result.failed += 1;
      console.error('[WeeklyReport] Cron failed for a user:', err.message);
    }
  }
  return result;
}

module.exports = {
  sendWeeklyEmails,
  lastCompletedWeek,
  weekFromDate,
  computeWeekFacts,
  templateReport,
  sanitiseReport,
  nextSlotStart,
  getWeeklyReport,
  REPORT_SCHEMA,
};
