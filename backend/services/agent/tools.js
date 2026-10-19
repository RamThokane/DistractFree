/**
 * The AI assistant's tools: what Gemini may look up, and what it may propose.
 *
 * Read tools return compact data from the same services the pages use, so the
 * assistant quotes exactly the numbers the user sees. "propose" tools never
 * write anything: they validate a change and return it as a proposal, which
 * the user confirms in the chat; the website then calls the normal API.
 *
 * Every handler gets the signed-in user's id from the server (ctx.userId);
 * the model never chooses whose data it reads.
 */

const FocusSession = require('../../models/FocusSession');
const { buildDashboard } = require('../dashboardService');
const { buildFullInsights } = require('../insightsService');
const { forecastForUser, recommendForUser } = require('../sessionRecommender');
const { toClientPrediction } = require('../predictionService');
const { checkSchedule, listOccurrences, ScheduleError, MAX_RANGE_DAYS, MIN_DURATION, MAX_DURATION } = require('../scheduleService');
const { DAY_MS } = require('../../utils/timezone');

const MAX_PROPOSED_SESSIONS = 5;
const MAX_RESULT_CHARS = 9000;

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const validDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "Tue 21 Oct, 4:00 PM" in the user's timezone. */
function localLabel(date, tz) {
  try {
    return new Date(date).toLocaleString('en-GB', {
      timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch {
    return new Date(date).toISOString();
  }
}

/** The bits of a prediction worth explaining. */
function compactForecast(p) {
  if (!p) return null;
  const c = toClientPrediction(p);
  return {
    successPercent: c.successPercent,
    riskLevel: c.riskLevel,
    plannedDuration: c.plannedDuration,
    source: c.source, // 'model' | 'history' | other: not enough data yet
    isColdStart: c.isColdStart,
    explanation: c.explanation || c.message || null,
    reasons: (c.reasons || []).map((r) => r.text).filter(Boolean).slice(0, 4),
    pastSuccessRate: c.baseline?.successRate != null ? Math.round(c.baseline.successRate * 100) : null,
    finishedSessions: c.baseline?.sessions ?? null,
  };
}

// ── Read tools ─────────────────────────────────────

async function getDashboardStats(ctx) {
  const d = await buildDashboard(ctx.userId, ctx.timezone, { now: ctx.now });
  return {
    timezone: d.timezone,
    today: {
      focusMinutes: d.todayFocusMinutes,
      sessions: d.sessionsToday,
      coinsEarned: d.coinsEarnedToday,
      goalMinutes: d.dailyGoal?.focusMinutes || d.goalMinutes,
    },
    focusCoinsBalance: d.focusCoins,
    currentStreakDays: d.currentStreak,
    longestStreakDays: d.longestStreak,
    last7Days: d.weeklyFocusData.map((x, i) => ({ date: x.date, day: x.day, focusMinutes: x.minutes, blockedAttempts: d.distractionTrend[i]?.score || 0 })),
    forecastIfStartedNow: d.nextSessionPrediction && {
      successPercent: d.nextSessionPrediction.successPercent,
      riskLevel: d.nextSessionPrediction.riskLevel,
      plannedDuration: d.nextSessionPrediction.plannedDuration,
      source: d.nextSessionPrediction.source,
    },
  };
}

async function getSessionHistory(ctx, args) {
  const days = clampInt(args.days, 1, 90, 14);
  const limit = clampInt(args.limit, 1, 50, 20);
  const since = new Date(ctx.now.getTime() - days * DAY_MS);
  const sessions = await FocusSession.find({ userId: ctx.userId, startTime: { $gte: since } })
    .sort({ startTime: -1 })
    .limit(limit)
    .select('startTime plannedDuration duration status distractionAttempts tabSwitches coinsEarned')
    .lean();
  return {
    days,
    count: sessions.length,
    // Same rule as the ML model: completed, ≥ 90% of the plan, at most one blocked attempt
    successRule: 'A session "went to plan" if it was completed, lasted at least 90% of the planned time, and had at most 1 blocked-site attempt.',
    sessions: sessions.map((s) => ({
      start: localLabel(s.startTime, ctx.timezone),
      plannedMinutes: s.plannedDuration,
      actualMinutes: s.duration || 0,
      status: s.status === 'cancelled' ? 'ended early' : s.status,
      blockedAttempts: s.distractionAttempts || 0,
      tabSwitches: s.tabSwitches || 0,
      coinsEarned: s.coinsEarned || 0,
    })),
  };
}

async function getInsights(ctx) {
  const i = await buildFullInsights(ctx.userId, ctx.timezone);
  const pw = i.productivityWindows || {};
  const dh = i.distractionHours || {};
  return {
    dataStatus: i.dataStatus,
    last7Days: {
      focusScore: i.features.focusScore,
      distractionScore: i.features.distractionScore,
      completionRatePercent: i.features.completionRate,
      avgSessionMinutes: i.features.sessionDuration,
      sessions: i.features.totalSessions,
      completed: i.features.completedSessions,
      endedEarly: i.features.cancelledSessions,
      avgBlockedAttemptsPerSession: i.features.blockedSiteAttempts,
      coinUnlocks: i.features.unlockAttempts,
      consistencyPercent: i.trends?.consistencyScore,
      totalFocusMinutes: i.trends?.totalFocusMinutes,
    },
    last30Days: {
      bestFocusHours: pw.bestFocusHours,
      bestHourCompletionRate: pw.bestCompletionRate,
      weakestHours: pw.weakestHours,
      weakestHourCompletionRate: pw.weakestCompletionRate,
      typicalSuccessfulLengthMinutes: pw.optimalSessionLength,
      peakDistractionWindow: dh.peakDistractionWindow,
      riskiestHours: (dh.topRiskHours || []).map((h) => ({ window: h.window, riskPercent: h.riskPercent, blockedAttempts: h.blockedAttempts, sessions: h.sessions })),
    },
    forecastNow: compactForecast(i.prediction),
    // Sites visited during focus sessions (7 days)
    topSitesDuringSessions: (i.topSites || []).slice(0, 5).map((s) => ({ site: s._id, visits: s.visits, blockedVisits: s.blockedVisits, coinUnlocks: s.unlocks, category: s.category })),
    tips: (i.recommendations || []).slice(0, 5).map((r) => ({ title: r.title, detail: r.description })),
  };
}

async function getForecast(ctx, args) {
  const startTime = validDate(args.startTime) || ctx.now;
  const plannedDuration = clampInt(args.plannedDuration, MIN_DURATION, MAX_DURATION, 25);
  const p = await forecastForUser(ctx.userId, { startTime, plannedDuration, timezone: ctx.timezone });
  return { start: localLabel(startTime, ctx.timezone), ...compactForecast(p), plannedDuration };
}

async function getRecommendation(ctx) {
  const r = await recommendForUser(ctx.userId, { timezone: ctx.timezone, now: ctx.now });
  if (r.status !== 'ready') return { status: r.status, message: r.message, finishedSessions: r.basedOn, needed: r.needed };
  const opt = (o) => o && { startAt: o.startAt, start: o.isNow ? 'now' : localLabel(o.startAt, ctx.timezone), plannedDuration: o.plannedDuration, successPercent: o.successPercent };
  return {
    status: 'ready',
    source: r.source,
    best: opt(r.best),
    soonest: opt(r.soonest),
    otherLength: opt(r.otherLength),
    why: r.why,
    basedOnSessions: r.basedOn,
  };
}

async function listSchedule(ctx, args) {
  const from = validDate(args.from) || ctx.now;
  let to = validDate(args.to) || new Date(from.getTime() + 7 * DAY_MS);
  if (to <= from) to = new Date(from.getTime() + DAY_MS);
  if (to - from > MAX_RANGE_DAYS * DAY_MS) to = new Date(from.getTime() + MAX_RANGE_DAYS * DAY_MS);
  const list = await listOccurrences(ctx.userId, from, to, ctx.now);
  return {
    from: localLabel(from, ctx.timezone),
    to: localLabel(to, ctx.timezone),
    count: list.length,
    sessions: list.slice(0, 40).map((o) => ({
      title: o.title,
      start: localLabel(o.startAt, ctx.timezone),
      startAt: new Date(o.startAt).toISOString(),
      plannedDuration: o.plannedDuration,
      repeat: o.repeat,
      status: o.status,
    })),
  };
}

// ── Proposal tools (write nothing) ─────────────────

const overlapsInPlan = (a, b) => a.start < b.end && b.start < a.end;

async function proposeSchedule(ctx, args) {
  const requested = Array.isArray(args.sessions) ? args.sessions.slice(0, MAX_PROPOSED_SESSIONS) : [];
  if (!requested.length) return { error: 'sessions must list at least one session' };

  const items = [];
  const accepted = []; // { start, end } of valid one-off items, to catch overlaps inside this plan
  for (const s of requested) {
    const input = {
      title: String(s.title || 'Focus session').trim().slice(0, 100) || 'Focus session',
      subject: String(s.subject || '').trim().slice(0, 60),
      startAt: s.startAt,
      plannedDuration: clampInt(s.plannedDuration, MIN_DURATION, MAX_DURATION, 25),
      repeat: ['none', 'daily', 'weekly'].includes(s.repeat) ? s.repeat : 'none',
      repeatDays: Array.isArray(s.repeatDays) ? s.repeatDays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
      timezone: ctx.timezone,
    };
    const item = { ...input, startAt: validDate(input.startAt)?.toISOString() || null, valid: true, problem: null, forecast: null };

    try {
      const fields = await checkSchedule(ctx.userId, input, ctx.now);
      item.repeatDays = fields.repeatDays;
      const span = { start: fields.startAt.getTime(), end: fields.startAt.getTime() + fields.plannedDuration * 60000 };
      if (accepted.some((a) => overlapsInPlan(a, span))) throw new ScheduleError(409, 'It overlaps another session in this plan');
      accepted.push(span);
    } catch (err) {
      if (!(err instanceof ScheduleError)) throw err;
      item.valid = false;
      const conflict = err.extra?.conflict;
      item.problem = conflict ? `It overlaps "${conflict.title}" at ${localLabel(conflict.startAt, ctx.timezone)}` : err.message;
    }

    if (item.startAt) {
      item.localLabel = localLabel(item.startAt, ctx.timezone);
      const p = await forecastForUser(ctx.userId, { startTime: new Date(item.startAt), plannedDuration: item.plannedDuration, timezone: ctx.timezone }).catch(() => null);
      const f = compactForecast(p);
      item.forecast = f && f.successPercent != null ? { successPercent: f.successPercent, riskLevel: f.riskLevel, source: f.source } : null;
    }
    items.push(item);
  }

  return {
    proposal: { kind: 'schedule', items },
    note: 'Nothing is scheduled yet. The user sees these as cards and must press Confirm.',
  };
}

// ── Declarations (Gemini function-calling schema) ──

const DECLARATIONS = [
  {
    name: 'getDashboardStats',
    description: "Today's focus minutes, sessions, coins earned and goal; Focus Coins balance; current and longest streak; focus minutes for each of the last 7 days; forecast for a session started now.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'getSessionHistory',
    description: "The user's recent focus sessions, newest first: start time, planned vs actual minutes, status (completed / ended early / active), blocked-site attempts, tab switches, coins.",
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'How many days back, 1-90 (default 14)' },
        limit: { type: 'integer', description: 'Max sessions, 1-50 (default 20)' },
      },
    },
  },
  {
    name: 'getInsights',
    description: 'What the AI Insights page shows: 7-day focus score, completion rate and averages; best and weakest focus hours and riskiest hours (30 days); the model forecast for now with its reasons; most-visited blocked sites; tips.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'getForecast',
    description: "The prediction model's chance that a session at a given start time and length goes to plan, with the reasons.",
    parameters: {
      type: 'object',
      properties: {
        startTime: { type: 'string', description: 'ISO 8601 start time with offset, e.g. 2026-10-21T16:00:00+05:30' },
        plannedDuration: { type: 'integer', description: 'Minutes, 5-240' },
      },
      required: ['startTime', 'plannedDuration'],
    },
  },
  {
    name: 'getRecommendation',
    description: 'The best start time and length for the next session in the next 24 hours, scored from the user\'s history or the model, with reasons.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'listSchedule',
    description: 'Sessions already planned in the calendar between two times (default: the next 7 days).',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'ISO 8601 start of range' },
        to: { type: 'string', description: 'ISO 8601 end of range' },
      },
    },
  },
  {
    name: 'proposeSchedule',
    description: 'Propose 1-5 calendar sessions. Saves NOTHING: it checks each one (future time, no overlaps), adds a forecast, and shows the user Confirm cards. Call it whenever the user wants sessions planned.',
    parameters: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Short title, e.g. "Deep work" or "Maths revision"' },
              startAt: { type: 'string', description: "ISO 8601 start time with the user's UTC offset" },
              plannedDuration: { type: 'integer', description: 'Minutes, 5-240' },
              repeat: { type: 'string', enum: ['none', 'daily', 'weekly'] },
              repeatDays: { type: 'array', items: { type: 'integer' }, description: 'Weekly only: weekdays 0=Sun..6=Sat; must include the first date\'s weekday' },
            },
            required: ['title', 'startAt', 'plannedDuration'],
          },
        },
      },
      required: ['sessions'],
    },
  },
];

const HANDLERS = {
  getDashboardStats,
  getSessionHistory,
  getInsights,
  getForecast,
  getRecommendation,
  listSchedule,
  proposeSchedule,
};

/** Run one tool call. Errors come back as data, so the model can say what went wrong. */
async function runTool(name, args, ctx) {
  const handler = HANDLERS[name];
  if (!handler) return { error: `Unknown tool ${name}` };
  try {
    const result = await handler(ctx, args && typeof args === 'object' ? args : {});
    const json = JSON.stringify(result);
    return json.length > MAX_RESULT_CHARS ? { truncated: true, data: json.slice(0, MAX_RESULT_CHARS) } : result;
  } catch (err) {
    console.error(`[Agent] Tool ${name} failed:`, err.message);
    return { error: 'This data could not be loaded right now.' };
  }
}

module.exports = { DECLARATIONS, HANDLERS, runTool, localLabel, compactForecast };
