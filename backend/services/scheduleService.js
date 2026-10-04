/**
 * Schedule Service — scheduled focus sessions.
 *
 * No cron job (the API runs on Vercel). Everything time-based happens when
 * the user's clients call in:
 *   - processDueSchedules()     on GET /api/session/active (extension every
 *                               minute, website on every dashboard page):
 *                               starts a due occurrence, marks overdue ones missed
 *   - sendScheduledReminders()  on GET /api/notifications (every minute)
 *
 * Repeating schedules are stored once (a "series") and expanded into
 * occurrences on the fly. An occurrence that needs its own state (started,
 * missed, cancelled, edited, reminded) is stored as an occurrence document
 * keyed by { seriesId, occurrenceStart }; see models/ScheduledSession.js.
 *
 * Occurrence ids in the API:
 *   "<docId>"                  a single session, or a stored occurrence
 *   "<seriesId>_<startMs>"     a computed occurrence of a series
 *   "<seriesId>"               (edit/cancel only) the whole series
 * Editing or cancelling an occurrence with scope 'following' splits its
 * series there: the old series gets repeatUntil, a new one carries on.
 */

const mongoose = require('mongoose');
const ScheduledSession = require('../models/ScheduledSession');
const FocusSession = require('../models/FocusSession');
const { createFocusSession } = require('./focusSessionService');
const { DAY_MS, zoneOr, localParts, zonedTimeToUtc, localDayNumber, dayFromNumber } = require('../utils/timezone');

const MINUTE_MS = 60 * 1000;
/** A scheduled session starts automatically up to this long after its start time. */
const START_WINDOW_MIN = 10;
/** Reminder lead time. */
const REMINDER_MIN = 10;
/** Overdue occurrences older than this are only shown as missed, never processed. */
const DUE_LOOKBACK_MS = DAY_MS;
/** How far ahead a repeating schedule is checked for overlaps. */
const OVERLAP_HORIZON_DAYS = 60;
/** Longest range GET /api/schedule returns in one call. */
const MAX_RANGE_DAYS = 120;
const MIN_DURATION = 5;
const MAX_DURATION = 240;
const MAX_EXPANDED = 500;

class ScheduleError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const endOf = (start, minutes) => new Date(new Date(start).getTime() + minutes * MINUTE_MS);
const virtualId = (seriesId, start) => `${seriesId}_${new Date(start).getTime()}`;
const keyOf = (seriesId, start) => `${seriesId}|${new Date(start).getTime()}`;

// ── Expansion ──────────────────────────────────────

/** Weekdays a weekly series runs on; defaults to the weekday of its first occurrence. */
function seriesDays(series) {
  if (series.repeat !== 'weekly') return null;
  if (series.repeatDays?.length) return series.repeatDays;
  return [localParts(series.startAt, zoneOr(series.timezone)).weekday];
}

/**
 * Computed start times of a series' occurrences that overlap [from, to).
 * Occurrences keep the local time of day of series.startAt in series.timezone.
 * @returns {Date[]}
 */
function expandSeries(series, from, to) {
  if (series.repeat === 'none') return [];
  const tz = zoneOr(series.timezone);
  const anchor = localParts(series.startAt, tz);
  const days = seriesDays(series);
  const durationMs = series.plannedDuration * MINUTE_MS;
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const anchorMs = new Date(series.startAt).getTime();
  const untilMs = series.repeatUntil ? new Date(series.repeatUntil).getTime() : Infinity;

  const first = Math.max(localDayNumber(series.startAt, tz), localDayNumber(new Date(fromMs - durationMs), tz) - 1);
  const last = localDayNumber(new Date(toMs), tz) + 1;
  const out = [];
  for (let n = first; n <= last && out.length < MAX_EXPANDED; n += 1) {
    const day = dayFromNumber(n);
    if (days && !days.includes(day.weekday)) continue;
    const start = zonedTimeToUtc({ ...day, hour: anchor.hour, minute: anchor.minute }, tz);
    const startMs = start.getTime();
    if (startMs < anchorMs || startMs >= untilMs || startMs >= toMs || startMs + durationMs <= fromMs) continue;
    out.push(start);
  }
  return out;
}

/** True when `start` is one of the series' computed occurrences. */
function isOccurrenceOf(series, start) {
  const t = new Date(start).getTime();
  return expandSeries(series, new Date(t), new Date(t + 1)).some((d) => d.getTime() === t);
}

// ── Views ──────────────────────────────────────────

/** Overdue scheduled occurrences are shown as missed before they are processed. */
function displayStatus(status, startAt, now) {
  if (status === 'scheduled' && now.getTime() >= endOf(startAt, START_WINDOW_MIN).getTime()) return 'missed';
  return status;
}

/** A stored single or occurrence document, as the API returns it. */
function docView(doc, series, now) {
  const fromSeries = series || null;
  return {
    id: String(doc._id),
    seriesId: doc.seriesId ? String(doc.seriesId) : null,
    title: doc.title,
    subject: doc.subject || '',
    startAt: doc.startAt,
    endAt: endOf(doc.startAt, doc.plannedDuration),
    plannedDuration: doc.plannedDuration,
    repeat: fromSeries ? fromSeries.repeat : 'none',
    repeatDays: fromSeries ? seriesDays(fromSeries) : [],
    timezone: doc.timezone,
    status: displayStatus(doc.status, doc.startAt, now),
    focusSessionId: doc.focusSessionId ? String(doc.focusSessionId) : null,
    isRepeating: Boolean(fromSeries && fromSeries.repeat !== 'none'),
  };
}

/** A computed occurrence of a series. */
function virtualView(series, start, now) {
  return {
    id: virtualId(series._id, start),
    seriesId: String(series._id),
    title: series.title,
    subject: series.subject || '',
    startAt: start,
    endAt: endOf(start, series.plannedDuration),
    plannedDuration: series.plannedDuration,
    repeat: series.repeat,
    repeatDays: seriesDays(series),
    timezone: series.timezone,
    status: displayStatus('scheduled', start, now),
    focusSessionId: null,
    isRepeating: true,
  };
}

/**
 * Every occurrence of the user's schedules overlapping [from, to), oldest first.
 * Cancelled ones are left out.
 */
async function listOccurrences(userId, from, to, now = new Date()) {
  const lookback = new Date(new Date(from).getTime() - MAX_DURATION * MINUTE_MS);
  const [docs, seriesList] = await Promise.all([
    ScheduledSession.find({ userId, repeat: 'none', startAt: { $gte: lookback, $lt: to } }).lean(),
    ScheduledSession.find({ userId, repeat: { $ne: 'none' }, status: { $ne: 'cancelled' }, startAt: { $lt: to } }).lean(),
  ]);

  const seriesById = new Map(seriesList.map((s) => [String(s._id), s]));
  // Stored occurrences replace computed ones, wherever they were moved to
  const storedKeys = new Set();
  if (seriesList.length) {
    const stored = await ScheduledSession.find({
      seriesId: { $in: seriesList.map((s) => s._id) },
      occurrenceStart: { $gte: lookback, $lt: to },
    }).select('seriesId occurrenceStart').lean();
    for (const s of stored) storedKeys.add(keyOf(s.seriesId, s.occurrenceStart));
  }
  // Series of stored occurrences that were cancelled or turned into singles
  const missingSeries = [...new Set(docs.filter((d) => d.seriesId && !seriesById.has(String(d.seriesId))).map((d) => String(d.seriesId)))];
  if (missingSeries.length) {
    for (const s of await ScheduledSession.find({ _id: { $in: missingSeries } }).lean()) seriesById.set(String(s._id), s);
  }

  const fromMs = new Date(from).getTime();
  const out = [];
  for (const doc of docs) {
    if (doc.status === 'cancelled' || endOf(doc.startAt, doc.plannedDuration).getTime() <= fromMs) continue;
    out.push(docView(doc, doc.seriesId ? seriesById.get(String(doc.seriesId)) : null, now));
  }
  for (const series of seriesList) {
    for (const start of expandSeries(series, from, to)) {
      if (!storedKeys.has(keyOf(series._id, start))) out.push(virtualView(series, start, now));
    }
  }
  return out.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
}

/** The next occurrence that has not started yet, or is still inside its start window. */
async function nextOccurrence(userId, now = new Date()) {
  const from = new Date(now.getTime() - START_WINDOW_MIN * MINUTE_MS);
  const to = new Date(now.getTime() + 30 * DAY_MS);
  const occurrences = await listOccurrences(userId, from, to, now);
  return occurrences.find((o) => o.status === 'scheduled' && new Date(o.startAt) >= from) || null;
}

/** { id, title, subject } of a schedule document, for the active-session response. */
async function scheduleSummary(id) {
  const doc = await ScheduledSession.findById(id).select('title subject').lean();
  return doc ? { id: String(doc._id), title: doc.title, subject: doc.subject || '' } : null;
}

// ── Validation and overlap ─────────────────────────

/**
 * Normalise and check a create/update payload (already shape-validated).
 * @returns {object} fields to store
 */
function cleanFields(input, { now = new Date(), requireFuture = true } = {}) {
  const out = {};
  if (input.title !== undefined) out.title = String(input.title).trim();
  if (input.subject !== undefined) out.subject = String(input.subject || '').trim();
  if (input.plannedDuration !== undefined) {
    const d = Number(input.plannedDuration);
    if (!Number.isInteger(d) || d < MIN_DURATION || d > MAX_DURATION) {
      throw new ScheduleError(400, `Duration must be between ${MIN_DURATION} and ${MAX_DURATION} minutes`);
    }
    out.plannedDuration = d;
  }
  if (input.startAt !== undefined) {
    const start = new Date(input.startAt);
    if (Number.isNaN(start.getTime())) throw new ScheduleError(400, 'startAt must be a valid date');
    if (requireFuture && start.getTime() <= now.getTime()) throw new ScheduleError(400, 'The start time must be in the future');
    out.startAt = start;
  }
  if (input.repeat !== undefined) out.repeat = input.repeat;
  if (input.repeatDays !== undefined) out.repeatDays = [...new Set((input.repeatDays || []).map(Number))].sort();
  if (input.timezone !== undefined) out.timezone = zoneOr(input.timezone);
  return out;
}

const overlaps = (a, b) => a.start < b.end && b.start < a.end;

/** repeatDays to store: [] unless weekly; weekly defaults to, and must include, the first date's weekday. */
function normaliseRepeatDays({ startAt, repeat, repeatDays, timezone }) {
  if (repeat !== 'weekly') return [];
  const day = localParts(startAt, zoneOr(timezone)).weekday;
  const days = repeatDays?.length ? [...repeatDays] : [day];
  if (!days.includes(day)) throw new ScheduleError(400, 'The first date must be one of the repeat days');
  return days;
}

/**
 * Throw 409 if a candidate schedule overlaps another of the user's scheduled
 * sessions. A repeating candidate is checked over the next OVERLAP_HORIZON_DAYS.
 *
 * @param {object} candidate { startAt, plannedDuration, repeat, repeatDays, timezone }
 * @param {object} [exclude] the thing being edited: { ids: occurrence/doc ids, seriesId: a whole series,
 *                           seriesFrom: { id, from } a series from an instant on }
 * @param {Date}   [now]
 * @param {Date}   [checkFrom] repeating candidates: check occurrences from here (default: candidate.startAt)
 */
async function assertNoOverlap(userId, candidate, exclude = {}, now = new Date(), checkFrom = candidate.startAt) {
  const repeating = candidate.repeat && candidate.repeat !== 'none';
  const from = repeating && checkFrom > candidate.startAt ? checkFrom : candidate.startAt;
  const horizonEnd = repeating
    ? new Date(new Date(from).getTime() + OVERLAP_HORIZON_DAYS * DAY_MS)
    : endOf(candidate.startAt, candidate.plannedDuration);

  const starts = repeating
    ? expandSeries({ ...candidate, _id: 'candidate' }, from, horizonEnd).filter((d) => d >= from)
    : [new Date(candidate.startAt)];
  if (!starts.length) return;
  const mine = starts.map((s) => ({ start: s.getTime(), end: endOf(s, candidate.plannedDuration).getTime() }));

  const excludedIds = new Set(exclude.ids || []);
  const replaced = (o) => exclude.seriesFrom && o.seriesId === exclude.seriesFrom.id && new Date(o.startAt) >= exclude.seriesFrom.from;
  const existing = (await listOccurrences(userId, starts[0], endOf(starts[starts.length - 1], candidate.plannedDuration), now))
    .filter((o) => ['scheduled', 'started'].includes(o.status))
    .filter((o) => !excludedIds.has(o.id) && !(exclude.seriesId && o.seriesId === exclude.seriesId) && !replaced(o));

  for (const o of existing) {
    const theirs = { start: new Date(o.startAt).getTime(), end: new Date(o.endAt).getTime() };
    if (mine.some((m) => overlaps(m, theirs))) {
      throw new ScheduleError(409, `This overlaps "${o.title}" at ${new Date(o.startAt).toISOString()}`, { conflict: o });
    }
  }
}

// ── Resolving ids ──────────────────────────────────

/**
 * @returns {Promise<{ kind: 'single'|'occurrence'|'virtual'|'series', doc?: object, series?: object, occurrenceStart?: Date }>}
 */
async function resolveTarget(userId, id) {
  const match = /^([a-f0-9]{24})_(\d{1,15})$/i.exec(String(id));
  if (match) {
    const series = await ScheduledSession.findOne({ _id: match[1], userId, repeat: { $ne: 'none' } });
    const occurrenceStart = new Date(Number(match[2]));
    if (!series || !isOccurrenceOf(series, occurrenceStart)) throw new ScheduleError(404, 'Scheduled session not found');
    const doc = await ScheduledSession.findOne({ seriesId: series._id, occurrenceStart });
    return doc ? { kind: 'occurrence', doc, series } : { kind: 'virtual', series, occurrenceStart };
  }
  if (!mongoose.isValidObjectId(id)) throw new ScheduleError(404, 'Scheduled session not found');
  const doc = await ScheduledSession.findOne({ _id: id, userId });
  if (!doc) throw new ScheduleError(404, 'Scheduled session not found');
  if (doc.repeat !== 'none') return { kind: 'series', doc, series: doc };
  if (doc.seriesId) return { kind: 'occurrence', doc, series: await ScheduledSession.findById(doc.seriesId) };
  return { kind: 'single', doc };
}

/** Fields an occurrence document copies from its series. */
const fromSeries = (series, occurrenceStart) => ({
  userId: series.userId,
  title: series.title,
  subject: series.subject,
  startAt: occurrenceStart,
  plannedDuration: series.plannedDuration,
  timezone: series.timezone,
  seriesId: series._id,
  occurrenceStart,
  repeat: 'none',
});

/**
 * Atomically move one occurrence from one of `fromStatuses` to `status`.
 * Computed occurrences are stored on the way. Returns the document, or null
 * when another request got there first.
 */
async function claim(target, status, fromStatuses = ['scheduled'], extra = {}) {
  if (target.doc) {
    return ScheduledSession.findOneAndUpdate(
      { _id: target.doc._id, status: { $in: fromStatuses } },
      { $set: { status, ...extra } },
      { new: true }
    );
  }
  try {
    return await ScheduledSession.create({ ...fromSeries(target.series, target.occurrenceStart), status, ...extra });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return ScheduledSession.findOneAndUpdate(
      { seriesId: target.series._id, occurrenceStart: target.occurrenceStart, status: { $in: fromStatuses } },
      { $set: { status, ...extra } },
      { new: true }
    );
  }
}

const timeLabel = (date, tz) => {
  try {
    return new Date(date).toLocaleTimeString('en-US', { timeZone: zoneOr(tz), hour: 'numeric', minute: '2-digit' });
  } catch {
    return new Date(date).toISOString().slice(11, 16);
  }
};

function notify(userId, type, title, message, metadata) {
  // Lazy require avoids a circular import with notificationController
  const { createNotification } = require('../controllers/notificationController');
  return createNotification(userId, type, title, message, metadata);
}

// ── Due processing ─────────────────────────────────

/** Occurrences that started in the last DUE_LOOKBACK_MS and were never processed, oldest first. */
async function dueOccurrences(userId, now) {
  const since = new Date(now.getTime() - DUE_LOOKBACK_MS);
  const [docs, seriesList] = await Promise.all([
    ScheduledSession.find({ userId, repeat: 'none', status: 'scheduled', startAt: { $gte: since, $lte: now } }),
    ScheduledSession.find({ userId, repeat: { $ne: 'none' }, status: 'scheduled', startAt: { $lte: now } }),
  ]);

  const targets = docs.map((doc) => ({ doc, start: doc.startAt }));
  if (seriesList.length) {
    const stored = await ScheduledSession.find({
      seriesId: { $in: seriesList.map((s) => s._id) },
      occurrenceStart: { $gte: new Date(since.getTime() - MAX_DURATION * MINUTE_MS), $lte: now },
    }).select('seriesId occurrenceStart').lean();
    const storedKeys = new Set(stored.map((s) => keyOf(s.seriesId, s.occurrenceStart)));
    for (const series of seriesList) {
      for (const start of expandSeries(series, since, new Date(now.getTime() + 1))) {
        if (start >= since && start <= now && !storedKeys.has(keyOf(series._id, start))) {
          targets.push({ series, occurrenceStart: start, start });
        }
      }
    }
  }
  return targets.sort((a, b) => a.start - b.start);
}

const titleOf = (target) => (target.doc || target.series).title;
const tzOf = (target) => (target.doc || target.series).timezone;

/**
 * Start the user's due scheduled session, and mark missed the ones that
 * could not start. Safe to call concurrently: every occurrence is claimed
 * atomically, so it starts (and notifies) at most once.
 *
 * @param {ObjectId} userId
 * @param {object} [options]
 * @param {Date}    [options.now]
 * @param {boolean} [options.allowStart=true] false = only mark overdue occurrences missed
 * @returns {Promise<{ started: object|null }>} the FocusSession started by this call
 */
async function processDueSchedules(userId, { now = new Date(), allowStart = true } = {}) {
  const due = await dueOccurrences(userId, now);
  if (!due.length) return { started: null };

  let active = await FocusSession.findOne({ userId, status: 'active' }).select('_id');
  let started = null;

  for (const target of due) {
    const overdue = now.getTime() >= endOf(target.start, START_WINDOW_MIN).getTime();

    if (overdue) {
      const doc = await claim(target, 'missed');
      if (doc) {
        await notify(userId, 'scheduled_missed', '⏰ Scheduled session missed',
          `"${doc.title}" was scheduled for ${timeLabel(doc.startAt, doc.timezone)} but didn't start.`,
          { scheduledSessionId: doc._id });
      }
      continue;
    }
    if (!allowStart) continue;

    if (active) {
      const doc = await claim(target, 'missed');
      if (doc) await notifySkipped(userId, doc);
      continue;
    }

    const doc = await claim(target, 'started');
    if (!doc) continue;
    // A session may have been started by hand between the check and the claim
    active = await FocusSession.findOne({ userId, status: 'active' }).select('_id');
    if (active) {
      doc.status = 'missed';
      await doc.save();
      await notifySkipped(userId, doc);
      continue;
    }

    try {
      const { session } = await createFocusSession({
        userId,
        plannedDuration: doc.plannedDuration,
        timezone: doc.timezone,
        scheduledSessionId: doc._id,
      });
      doc.focusSessionId = session._id;
      await doc.save();
      active = session;
      started = session;
      await notify(userId, 'scheduled_started', '🎯 Focus session started',
        `"${doc.title}" started automatically — ${doc.plannedDuration} minutes. Good luck!`,
        { scheduledSessionId: doc._id, sessionId: session._id });
    } catch (error) {
      // Leave it to be retried by the next call
      doc.status = 'scheduled';
      await doc.save();
      throw error;
    }
  }

  return { started };
}

function notifySkipped(userId, doc) {
  return notify(userId, 'scheduled_missed', 'Scheduled session skipped — another session was running',
    `"${doc.title}" (${timeLabel(doc.startAt, doc.timezone)}) didn't start because another focus session was already running.`,
    { scheduledSessionId: doc._id, reason: 'session_running' });
}

/** Send the 10-minute reminder for occurrences starting soon (once each). */
async function sendScheduledReminders(userId, now = new Date()) {
  const until = new Date(now.getTime() + REMINDER_MIN * MINUTE_MS);
  const [docs, seriesList] = await Promise.all([
    ScheduledSession.find({ userId, repeat: 'none', status: 'scheduled', reminderSent: false, startAt: { $gt: now, $lte: until } }),
    ScheduledSession.find({ userId, repeat: { $ne: 'none' }, status: 'scheduled', startAt: { $lte: until } }),
  ]);

  const reminded = [];
  for (const doc of docs) {
    const claimed = await ScheduledSession.findOneAndUpdate({ _id: doc._id, reminderSent: false }, { $set: { reminderSent: true } }, { new: true });
    if (claimed) reminded.push(claimed);
  }
  for (const series of seriesList) {
    for (const start of expandSeries(series, now, until)) {
      if (start <= now || start > until) continue;
      try {
        // Stored with reminderSent so the reminder goes out once
        reminded.push(await ScheduledSession.create({ ...fromSeries(series, start), status: 'scheduled', reminderSent: true }));
      } catch (error) {
        if (error.code !== 11000) throw error; // already stored: handled by the query above
      }
    }
  }

  for (const doc of reminded) {
    const minutes = Math.max(1, Math.round((doc.startAt - now) / MINUTE_MS));
    await notify(userId, 'scheduled_reminder', `⏰ "${doc.title}" starts in ${minutes} min`,
      `Your ${doc.plannedDuration}-minute focus session starts at ${timeLabel(doc.startAt, doc.timezone)}. It will start automatically.`,
      { scheduledSessionId: doc._id });
  }
  return reminded.length;
}

// ── Commands ───────────────────────────────────────

async function createSchedule(userId, input, now = new Date()) {
  const fields = cleanFields(input, { now });
  const repeat = fields.repeat || 'none';
  const candidate = { plannedDuration: fields.plannedDuration, startAt: fields.startAt, repeat, repeatDays: fields.repeatDays || [], timezone: fields.timezone || 'UTC' };
  candidate.repeatDays = normaliseRepeatDays(candidate);

  await assertNoOverlap(userId, candidate, {}, now);
  const doc = await ScheduledSession.create({ userId, title: fields.title, subject: fields.subject || '', ...candidate });
  return repeat === 'none' ? docView(doc, null, now) : virtualView(doc, doc.startAt, now);
}

/** Edit a whole series in place. */
async function updateSeries(userId, series, fields, now) {
  if (series.status === 'cancelled') throw new ScheduleError(400, 'This repeating session was cancelled');
  const next = {
    startAt: fields.startAt || series.startAt,
    plannedDuration: fields.plannedDuration ?? series.plannedDuration,
    repeat: fields.repeat || series.repeat,
    repeatDays: fields.repeatDays ?? series.repeatDays,
    timezone: fields.timezone || series.timezone,
  };
  next.repeatDays = normaliseRepeatDays(next);
  if (next.repeat === 'none' && next.startAt <= now) throw new ScheduleError(400, 'The start time must be in the future');
  // Occurrences from now on follow the new settings; earlier ones are history
  await assertNoOverlap(userId, { ...next, repeatUntil: series.repeatUntil }, { ids: [String(series._id)], seriesId: String(series._id) }, now, now);

  Object.assign(series, fields, next);
  await series.save();
  // Reminder-only occurrence documents were computed from the old settings
  await ScheduledSession.deleteMany({ seriesId: series._id, status: 'scheduled', edited: false, occurrenceStart: { $gt: now } });
  return virtualOrDoc(series, now);
}

/**
 * "This and following": end the series before this occurrence and start a
 * new one here with the changes. Earlier occurrences are left as they were.
 */
async function updateFollowing(userId, target, fields, now) {
  const { series } = target;
  const occurrenceStart = target.occurrenceStart || target.doc.occurrenceStart;
  if (!series || series.status === 'cancelled' || series.repeat === 'none') {
    throw new ScheduleError(400, 'This session is no longer part of a repeating series');
  }
  if (occurrenceStart.getTime() <= new Date(series.startAt).getTime()) return updateSeries(userId, series, fields, now);

  const next = {
    title: fields.title ?? series.title,
    subject: fields.subject ?? series.subject,
    startAt: fields.startAt || occurrenceStart,
    plannedDuration: fields.plannedDuration ?? series.plannedDuration,
    repeat: fields.repeat || series.repeat,
    repeatDays: fields.repeatDays ?? series.repeatDays,
    timezone: fields.timezone || series.timezone,
  };
  if (next.startAt <= now) throw new ScheduleError(400, 'The start time must be in the future');
  next.repeatDays = normaliseRepeatDays(next);
  await assertNoOverlap(userId, next, { seriesFrom: { id: String(series._id), from: occurrenceStart } }, now);

  series.repeatUntil = occurrenceStart;
  await series.save();
  // Stored occurrences from here on belonged to the part being replaced
  await ScheduledSession.updateMany(
    { seriesId: series._id, status: 'scheduled', occurrenceStart: { $gte: occurrenceStart } },
    { $set: { status: 'cancelled' } }
  );
  const created = await ScheduledSession.create({ userId, ...next });
  return virtualOrDoc(created, now);
}

/**
 * @param {object} [options]
 * @param {'occurrence'|'following'} [options.scope='occurrence'] for an occurrence of a series
 */
async function updateSchedule(userId, id, input, now = new Date(), { scope = 'occurrence' } = {}) {
  const target = await resolveTarget(userId, id);
  const fields = cleanFields(input, { now });

  if (target.kind === 'series') return updateSeries(userId, target.doc, fields, now);
  if (scope === 'following' && target.series && target.kind !== 'single') return updateFollowing(userId, target, fields, now);

  const doc = target.doc;
  if (doc && !['scheduled', 'missed'].includes(doc.status)) {
    throw new ScheduleError(400, `A ${doc.status} session can't be edited`);
  }
  if (target.kind !== 'single' && fields.repeat && fields.repeat !== 'none') {
    throw new ScheduleError(400, 'Edit the whole series to change how it repeats');
  }

  const base = doc || fromSeries(target.series, target.occurrenceStart);
  const startAt = fields.startAt || base.startAt;
  if (startAt <= now) throw new ScheduleError(400, 'The start time must be in the future');
  const repeat = target.kind === 'single' ? fields.repeat || 'none' : 'none';
  const timezone = fields.timezone || base.timezone;
  const repeatDays = normaliseRepeatDays({
    startAt, repeat, timezone,
    repeatDays: target.kind === 'single' ? fields.repeatDays ?? (doc.repeatDays || []) : [],
  });
  const candidate = { startAt, plannedDuration: fields.plannedDuration ?? base.plannedDuration, repeat, repeatDays, timezone };
  const selfIds = [doc ? String(doc._id) : null, target.series ? virtualId(target.series._id, target.occurrenceStart || doc.occurrenceStart) : null].filter(Boolean);
  await assertNoOverlap(userId, candidate, { ids: selfIds, seriesId: repeat !== 'none' && doc ? String(doc._id) : undefined }, now);

  const changes = {
    ...fields,
    ...candidate,
    status: 'scheduled',
    // A moved session gets a fresh reminder
    reminderSent: startAt.getTime() === new Date(base.startAt).getTime() ? Boolean(doc?.reminderSent) : false,
  };
  if (target.kind === 'virtual') {
    const created = await ScheduledSession.create({ ...fromSeries(target.series, target.occurrenceStart), ...changes, repeat: 'none', edited: true });
    return docView(created, target.series, now);
  }
  Object.assign(doc, changes, target.kind === 'occurrence' ? { edited: true } : {});
  await doc.save();
  return virtualOrDoc(doc, now, target.series);
}

const virtualOrDoc = (doc, now, series = null) => (doc.repeat !== 'none' ? virtualView(doc, doc.startAt, now) : docView(doc, series, now));

/**
 * @param {object} [options]
 * @param {'occurrence'|'following'} [options.scope='occurrence'] for an occurrence of a series:
 *        'following' cancels this occurrence and every later one
 */
async function cancelSchedule(userId, id, now = new Date(), { scope = 'occurrence' } = {}) {
  const target = await resolveTarget(userId, id);
  const occurrenceStart = target.occurrenceStart || target.doc?.occurrenceStart;
  const following = scope === 'following' && target.kind !== 'single' && target.series && occurrenceStart;
  const wholeSeries = target.kind === 'series' || (following && occurrenceStart <= target.series.startAt);

  if (wholeSeries) {
    const series = target.series || target.doc;
    series.status = 'cancelled';
    await series.save();
    // Future occurrences go with it; started/missed ones stay as history
    await ScheduledSession.updateMany({ seriesId: series._id, status: 'scheduled' }, { $set: { status: 'cancelled' } });
    return { cancelled: 'series' };
  }
  if (following) {
    target.series.repeatUntil = occurrenceStart;
    await target.series.save();
    await ScheduledSession.updateMany(
      { seriesId: target.series._id, status: { $in: ['scheduled', 'missed'] }, occurrenceStart: { $gte: occurrenceStart } },
      { $set: { status: 'cancelled' } }
    );
    return { cancelled: 'following' };
  }
  const doc = await claim(target, 'cancelled', ['scheduled', 'missed']);
  if (!doc) throw new ScheduleError(400, "This session already started and can't be cancelled here — end it from the Focus page");
  return { cancelled: 'occurrence', occurrence: docView(doc, target.series, now) };
}

/** Start a scheduled (upcoming or missed) occurrence right now. */
async function startScheduledNow(userId, id, now = new Date()) {
  const target = await resolveTarget(userId, id);
  if (target.kind === 'series') throw new ScheduleError(400, 'Pick one occurrence of the repeating session to start');

  const running = await FocusSession.findOne({ userId, status: 'active' });
  if (running) throw new ScheduleError(409, 'You already have an active focus session', { session: running });

  const doc = await claim(target, 'started', ['scheduled', 'missed']);
  if (!doc) throw new ScheduleError(400, 'This session was already started or cancelled');
  try {
    const { session, prediction } = await createFocusSession({
      userId,
      plannedDuration: doc.plannedDuration,
      timezone: doc.timezone,
      scheduledSessionId: doc._id,
    });
    doc.focusSessionId = session._id;
    await doc.save();
    return { session, prediction, occurrence: docView(doc, target.series, now) };
  } catch (error) {
    doc.status = target.doc?.status || 'scheduled';
    await doc.save();
    throw error;
  }
}

module.exports = {
  START_WINDOW_MIN,
  REMINDER_MIN,
  MAX_RANGE_DAYS,
  MIN_DURATION,
  MAX_DURATION,
  ScheduleError,
  expandSeries,
  listOccurrences,
  nextOccurrence,
  scheduleSummary,
  assertNoOverlap,
  resolveTarget,
  processDueSchedules,
  sendScheduledReminders,
  createSchedule,
  updateSchedule,
  cancelSchedule,
  startScheduledNow,
};
