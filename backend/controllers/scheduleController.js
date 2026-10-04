const FocusSession = require('../models/FocusSession');
const ScheduledSession = require('../models/ScheduledSession');
const { toClientPrediction } = require('../services/predictionService');
const {
  MAX_RANGE_DAYS,
  ScheduleError,
  listOccurrences,
  nextOccurrence,
  createSchedule,
  updateSchedule,
  cancelSchedule,
  startScheduledNow,
} = require('../services/scheduleService');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Send a ScheduleError as its status, anything else as a 500. */
function fail(res, error, label) {
  if (error instanceof ScheduleError) {
    return res.status(error.status).json({ success: false, message: error.message, ...error.extra });
  }
  console.error(`[Schedule] ${label} error:`, error.message);
  return res.status(500).json({ success: false, message: 'Server error' });
}

const scopeOf = (req) => (req.query.scope === 'following' ? 'following' : 'occurrence');

const fieldsFrom = (body) => {
  const out = {};
  for (const key of ['title', 'subject', 'startAt', 'plannedDuration', 'repeat', 'repeatDays', 'timezone']) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
};

// ────────────────────────────────────────────────────
// POST /api/schedule
// ────────────────────────────────────────────────────
exports.createSchedule = async (req, res) => {
  try {
    const occurrence = await createSchedule(req.user._id, fieldsFrom(req.body));
    res.status(201).json({ success: true, occurrence });
  } catch (error) {
    fail(res, error, 'Create');
  }
};

// ────────────────────────────────────────────────────
// GET /api/schedule?from=ISO&to=ISO
// Scheduled occurrences (repeating ones expanded) plus the focus sessions
// actually run in the range, for the calendar.
// ────────────────────────────────────────────────────
exports.listSchedule = async (req, res) => {
  try {
    const from = new Date(req.query.from);
    const to = new Date(req.query.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return res.status(400).json({ success: false, message: 'from and to must be valid dates, with from before to' });
    }
    if (to - from > MAX_RANGE_DAYS * DAY_MS) {
      return res.status(400).json({ success: false, message: `The range can be at most ${MAX_RANGE_DAYS} days` });
    }

    const userId = req.user._id;
    const [occurrences, sessions] = await Promise.all([
      listOccurrences(userId, from, to),
      FocusSession.find({ userId, startTime: { $gte: from, $lt: to } })
        .select('startTime endTime plannedDuration duration status coinsEarned scheduledSessionId')
        .sort({ startTime: 1 })
        .lean(),
    ]);

    // Titles for sessions that came from a schedule
    const scheduleIds = sessions.map((s) => s.scheduledSessionId).filter(Boolean);
    const titles = new Map(
      (await ScheduledSession.find({ _id: { $in: scheduleIds } }).select('title subject').lean())
        .map((s) => [String(s._id), s])
    );

    res.json({
      success: true,
      serverTime: new Date().toISOString(),
      occurrences,
      focusSessions: sessions.map((s) => {
        const schedule = s.scheduledSessionId ? titles.get(String(s.scheduledSessionId)) : null;
        return {
          id: String(s._id),
          startTime: s.startTime,
          endTime: s.endTime,
          plannedDuration: s.plannedDuration,
          duration: s.duration,
          status: s.status,
          coinsEarned: s.coinsEarned,
          scheduledSessionId: s.scheduledSessionId ? String(s.scheduledSessionId) : null,
          title: schedule?.title || null,
          subject: schedule?.subject || '',
        };
      }),
    });
  } catch (error) {
    fail(res, error, 'List');
  }
};

// ────────────────────────────────────────────────────
// GET /api/schedule/next — for the dashboard card
// ────────────────────────────────────────────────────
exports.getNextSchedule = async (req, res) => {
  try {
    res.json({ success: true, serverTime: new Date().toISOString(), occurrence: await nextOccurrence(req.user._id) });
  } catch (error) {
    fail(res, error, 'Next');
  }
};

// ────────────────────────────────────────────────────
// PUT /api/schedule/:id[?scope=following] — an occurrence id edits that
// occurrence (scope=following: it and every later one), a series id edits
// the whole repeating series
// ────────────────────────────────────────────────────
exports.updateSchedule = async (req, res) => {
  try {
    const occurrence = await updateSchedule(req.user._id, req.params.id, fieldsFrom(req.body), new Date(), { scope: scopeOf(req) });
    res.json({ success: true, occurrence });
  } catch (error) {
    fail(res, error, 'Update');
  }
};

// ────────────────────────────────────────────────────
// DELETE /api/schedule/:id[?scope=following] — cancel one occurrence
// (scope=following: it and every later one), or a whole series
// ────────────────────────────────────────────────────
exports.cancelSchedule = async (req, res) => {
  try {
    res.json({ success: true, ...(await cancelSchedule(req.user._id, req.params.id, new Date(), { scope: scopeOf(req) })) });
  } catch (error) {
    fail(res, error, 'Cancel');
  }
};

// ────────────────────────────────────────────────────
// POST /api/schedule/:id/start-now
// ────────────────────────────────────────────────────
exports.startNow = async (req, res) => {
  try {
    const { session, prediction, occurrence } = await startScheduledNow(req.user._id, req.params.id);
    res.status(201).json({
      success: true,
      serverTime: new Date().toISOString(),
      session,
      occurrence,
      schedule: { id: occurrence.id, title: occurrence.title, subject: occurrence.subject },
      prediction: prediction ? toClientPrediction(prediction) : null,
    });
  } catch (error) {
    fail(res, error, 'Start now');
  }
};
