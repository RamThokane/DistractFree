const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ScheduledSession = require('../models/ScheduledSession');
const FocusSession = require('../models/FocusSession');
const Notification = require('../models/Notification');
const {
  expandSeries,
  listOccurrences,
  nextOccurrence,
  createSchedule,
  updateSchedule,
  cancelSchedule,
  startScheduledNow,
  processDueSchedules,
  sendScheduledReminders,
} = require('../services/scheduleService');
const { zonedTimeToUtc, localParts } = require('../utils/timezone');
const { getActiveSession } = require('../controllers/sessionController');

const MIN = 60 * 1000;
const TZ = 'Asia/Kolkata';
let mongod;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await ScheduledSession.syncIndexes();
});
test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
test.beforeEach(async () => {
  await Promise.all([ScheduledSession.deleteMany({}), FocusSession.deleteMany({}), Notification.deleteMany({})]);
});

const user = () => new mongoose.Types.ObjectId();
const at = (iso) => new Date(iso);
const plan = (overrides = {}) => ({ title: 'Deep work', subject: 'Maths', plannedDuration: 30, timezone: TZ, ...overrides });

/** Minimal Express req/res for calling a controller. */
async function callController(handler, userId, query = {}) {
  let body;
  let status = 200;
  await handler({ user: { _id: userId }, query, params: {}, body: {} }, {
    status(code) { status = code; return this; },
    json(payload) { body = payload; return this; },
  });
  return { status, body };
}

// ── Timezones and repeats (pure) ───────────────────

test('local wall-clock times convert to the right instant, including across DST', () => {
  assert.equal(zonedTimeToUtc({ year: 2026, month: 3, day: 2, hour: 9, minute: 0 }, TZ).toISOString(), '2026-03-02T03:30:00.000Z');
  // New York: 9:00 is 14:00 UTC in winter and 13:00 UTC in summer
  assert.equal(zonedTimeToUtc({ year: 2026, month: 3, day: 6, hour: 9, minute: 0 }, 'America/New_York').toISOString(), '2026-03-06T14:00:00.000Z');
  assert.equal(zonedTimeToUtc({ year: 2026, month: 3, day: 9, hour: 9, minute: 0 }, 'America/New_York').toISOString(), '2026-03-09T13:00:00.000Z');
});

test('a weekly series repeats on its weekdays at the same local time, across a DST change', () => {
  // Fri 6 Mar 2026, 9:00 New York; repeats Mon + Fri
  const series = { _id: 's', repeat: 'weekly', repeatDays: [1, 5], startAt: at('2026-03-06T14:00:00Z'), plannedDuration: 30, timezone: 'America/New_York' };
  const starts = expandSeries(series, at('2026-03-01T00:00:00Z'), at('2026-03-17T00:00:00Z')).map((d) => d.toISOString());
  assert.deepEqual(starts, [
    '2026-03-06T14:00:00.000Z', // Fri (EST)
    '2026-03-09T13:00:00.000Z', // Mon (EDT — clocks changed on 8 Mar)
    '2026-03-13T13:00:00.000Z', // Fri
    '2026-03-16T13:00:00.000Z', // Mon
  ]);
  for (const s of starts) assert.equal(localParts(s, 'America/New_York').hour, 9);
});

test('a daily series never produces occurrences before its first one', () => {
  const series = { _id: 's', repeat: 'daily', repeatDays: [], startAt: at('2026-03-05T03:30:00Z'), plannedDuration: 30, timezone: TZ };
  const starts = expandSeries(series, at('2026-03-01T00:00:00Z'), at('2026-03-08T00:00:00Z'));
  assert.deepEqual(starts.map((d) => d.toISOString().slice(0, 10)), ['2026-03-05', '2026-03-06', '2026-03-07']);
});

// ── Create, overlap, list ──────────────────────────

test('a session must start in the future', async () => {
  const now = at('2026-03-02T10:00:00Z');
  await assert.rejects(createSchedule(user(), plan({ startAt: '2026-03-02T09:59:00Z' }), now), /must be in the future/);
});

test('overlapping scheduled sessions are rejected, back-to-back ones are allowed', async () => {
  const uid = user();
  const now = at('2026-03-02T00:00:00Z');
  await createSchedule(uid, plan({ startAt: '2026-03-02T10:00:00Z', plannedDuration: 60 }), now);

  await assert.rejects(createSchedule(uid, plan({ startAt: '2026-03-02T10:30:00Z' }), now), (e) => e.status === 409);
  await assert.rejects(createSchedule(uid, plan({ startAt: '2026-03-02T09:45:00Z' }), now), (e) => e.status === 409);
  await createSchedule(uid, plan({ startAt: '2026-03-02T11:00:00Z' }), now); // starts as the first ends
  // Another user's schedule never conflicts
  await createSchedule(user(), plan({ startAt: '2026-03-02T10:30:00Z' }), now);
});

test('a weekly series that would hit an existing session later on is rejected', async () => {
  const uid = user();
  const now = at('2026-03-01T00:00:00Z');
  // Mon 16 Mar, 9:00 IST
  await createSchedule(uid, plan({ startAt: '2026-03-16T03:30:00Z' }), now);
  // Every Monday 9:15 IST from 2 Mar
  await assert.rejects(
    createSchedule(uid, plan({ startAt: '2026-03-02T03:45:00Z', repeat: 'weekly', repeatDays: [1] }), now),
    (e) => e.status === 409
  );
  // Tuesdays are fine
  await createSchedule(uid, plan({ startAt: '2026-03-03T03:45:00Z', repeat: 'weekly', repeatDays: [2] }), now);
});

test('listing expands repeating sessions and marks overdue ones missed', async () => {
  const uid = user();
  await createSchedule(uid, plan({ startAt: '2026-03-02T03:30:00Z', repeat: 'daily' }), at('2026-03-01T00:00:00Z'));
  const list = await listOccurrences(uid, at('2026-03-02T00:00:00Z'), at('2026-03-05T00:00:00Z'), at('2026-03-03T12:00:00Z'));
  assert.deepEqual(list.map((o) => o.status), ['missed', 'missed', 'scheduled']);
  assert.ok(list.every((o) => o.isRepeating && o.repeat === 'daily'));
  assert.match(list[2].id, /^[a-f0-9]{24}_\d+$/);
});

// ── Auto-start ─────────────────────────────────────

test('a due session starts once, even when two clients ask at the same moment', async () => {
  const uid = user();
  const occurrence = await createSchedule(uid, plan({ startAt: '2026-03-02T10:00:00Z' }), at('2026-03-02T09:00:00Z'));
  const now = at('2026-03-02T10:02:00Z');

  const results = await Promise.all([processDueSchedules(uid, { now }), processDueSchedules(uid, { now })]);
  assert.equal(results.filter((r) => r.started).length, 1);

  const sessions = await FocusSession.find({ userId: uid });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].status, 'active');
  assert.equal(sessions[0].plannedDuration, 30);
  assert.equal(String(sessions[0].scheduledSessionId), occurrence.id);

  const doc = await ScheduledSession.findById(occurrence.id);
  assert.equal(doc.status, 'started');
  assert.equal(String(doc.focusSessionId), String(sessions[0]._id));
  assert.equal(await Notification.countDocuments({ userId: uid, type: 'scheduled_started' }), 1);
});

test('nothing starts before the start time', async () => {
  const uid = user();
  await createSchedule(uid, plan({ startAt: '2026-03-02T10:00:00Z' }), at('2026-03-02T09:00:00Z'));
  const { started } = await processDueSchedules(uid, { now: at('2026-03-02T09:59:00Z') });
  assert.equal(started, null);
  assert.equal(await FocusSession.countDocuments({ userId: uid }), 0);
});

test('more than 10 minutes late: marked missed, with a notification, and never started', async () => {
  const uid = user();
  const occurrence = await createSchedule(uid, plan({ startAt: '2026-03-02T10:00:00Z' }), at('2026-03-02T09:00:00Z'));
  await processDueSchedules(uid, { now: at('2026-03-02T10:11:00Z') });
  assert.equal((await ScheduledSession.findById(occurrence.id)).status, 'missed');
  assert.equal(await FocusSession.countDocuments({ userId: uid }), 0);
  assert.equal(await Notification.countDocuments({ userId: uid, type: 'scheduled_missed' }), 1);
  // Not notified twice
  await processDueSchedules(uid, { now: at('2026-03-02T10:12:00Z') });
  assert.equal(await Notification.countDocuments({ userId: uid, type: 'scheduled_missed' }), 1);
});

test('when another session is running, the scheduled one is skipped and the user told why', async () => {
  const uid = user();
  await FocusSession.create({ userId: uid, plannedDuration: 50, startTime: at('2026-03-02T09:40:00Z') });
  const occurrence = await createSchedule(uid, plan({ startAt: '2026-03-02T10:00:00Z' }), at('2026-03-02T09:00:00Z'));
  await processDueSchedules(uid, { now: at('2026-03-02T10:01:00Z') });

  assert.equal((await ScheduledSession.findById(occurrence.id)).status, 'missed');
  assert.equal(await FocusSession.countDocuments({ userId: uid }), 1);
  const note = await Notification.findOne({ userId: uid, type: 'scheduled_missed' });
  assert.equal(note.title, 'Scheduled session skipped — another session was running');
});

test('an occurrence of a weekly series starts on its day and only that occurrence is marked started', async () => {
  const uid = user();
  // Every Monday 9:00 IST from 2 Mar
  const first = await createSchedule(uid, plan({ startAt: '2026-03-02T03:30:00Z', repeat: 'weekly', repeatDays: [1] }), at('2026-03-01T00:00:00Z'));
  const { started } = await processDueSchedules(uid, { now: at('2026-03-09T03:31:00Z') }); // the second Monday
  assert.ok(started);

  const stored = await ScheduledSession.findOne({ seriesId: first.seriesId });
  assert.equal(stored.status, 'started');
  assert.equal(stored.occurrenceStart.toISOString(), '2026-03-09T03:30:00.000Z');
  // The first Monday (older than the look-back window) stays a computed, missed occurrence
  const list = await listOccurrences(uid, at('2026-03-01T00:00:00Z'), at('2026-03-17T00:00:00Z'), at('2026-03-09T03:31:00Z'));
  assert.deepEqual(list.map((o) => o.status), ['missed', 'started', 'scheduled']);
});

test('GET /session/active starts a due session and says so; the next call just returns it', async () => {
  const uid = user();
  const startAt = new Date(Date.now() - 2 * MIN);
  const doc = await ScheduledSession.create({ userId: uid, ...plan(), startAt });

  const first = await callController(getActiveSession, uid);
  assert.equal(first.body.autoStarted, true);
  assert.equal(String(first.body.session.scheduledSessionId), String(doc._id));
  assert.deepEqual(first.body.schedule, { id: String(doc._id), title: 'Deep work', subject: 'Maths' });

  const second = await callController(getActiveSession, uid);
  assert.equal(second.body.autoStarted, false);
  assert.equal(String(second.body.session._id), String(first.body.session._id));
});

// ── Reminders, cancel, edit, start now ─────────────

test('the reminder goes out once, 10 minutes ahead, for single and repeating sessions', async () => {
  const uid = user();
  await createSchedule(uid, plan({ startAt: '2026-03-02T10:00:00Z' }), at('2026-03-02T08:00:00Z'));
  await createSchedule(uid, plan({ title: 'Reading', startAt: '2026-03-02T11:00:00Z', repeat: 'daily' }), at('2026-03-02T08:00:00Z'));

  assert.equal(await sendScheduledReminders(uid, at('2026-03-02T09:45:00Z')), 0);
  assert.equal(await sendScheduledReminders(uid, at('2026-03-02T09:51:00Z')), 1);
  assert.equal(await sendScheduledReminders(uid, at('2026-03-02T09:52:00Z')), 0);
  assert.equal(await sendScheduledReminders(uid, at('2026-03-02T10:52:00Z')), 1); // the daily one
  assert.equal(await sendScheduledReminders(uid, at('2026-03-02T10:53:00Z')), 0);
  assert.equal(await Notification.countDocuments({ userId: uid, type: 'scheduled_reminder' }), 2);
});

test('cancelling one occurrence keeps the rest of the series; cancelling the series removes the future', async () => {
  const uid = user();
  const now = at('2026-03-01T00:00:00Z');
  const first = await createSchedule(uid, plan({ startAt: '2026-03-02T03:30:00Z', repeat: 'daily' }), now);
  const range = [at('2026-03-02T00:00:00Z'), at('2026-03-05T00:00:00Z'), now];

  const [, second] = await listOccurrences(uid, ...range);
  await cancelSchedule(uid, second.id, now);
  assert.deepEqual((await listOccurrences(uid, ...range)).map((o) => o.startAt.toISOString().slice(0, 10)), ['2026-03-02', '2026-03-04']);

  await cancelSchedule(uid, first.seriesId, now);
  assert.equal((await listOccurrences(uid, ...range)).length, 0);
  // Nothing starts afterwards
  assert.equal((await processDueSchedules(uid, { now: at('2026-03-04T03:31:00Z') })).started, null);
});

test('editing one occurrence moves only that one; editing the series changes the rest', async () => {
  const uid = user();
  const now = at('2026-03-01T00:00:00Z');
  const first = await createSchedule(uid, plan({ startAt: '2026-03-02T03:30:00Z', repeat: 'daily' }), now);
  const range = [at('2026-03-02T00:00:00Z'), at('2026-03-05T00:00:00Z'), now];

  const [, second] = await listOccurrences(uid, ...range);
  await updateSchedule(uid, second.id, { startAt: '2026-03-03T05:30:00Z', title: 'Moved' }, now);
  let list = await listOccurrences(uid, ...range);
  assert.deepEqual(list.map((o) => [o.startAt.toISOString().slice(0, 16), o.title]), [
    ['2026-03-02T03:30', 'Deep work'],
    ['2026-03-03T05:30', 'Moved'],
    ['2026-03-04T03:30', 'Deep work'],
  ]);

  await updateSchedule(uid, first.seriesId, { plannedDuration: 45, title: 'Revision' }, now);
  list = await listOccurrences(uid, ...range);
  assert.deepEqual(list.map((o) => [o.title, o.plannedDuration]), [['Revision', 45], ['Moved', 30], ['Revision', 45]]);
});

test('an edit that would overlap another session is rejected, and an edit can be overlap-free with itself', async () => {
  const uid = user();
  const now = at('2026-03-02T00:00:00Z');
  const a = await createSchedule(uid, plan({ startAt: '2026-03-02T10:00:00Z' }), now);
  await createSchedule(uid, plan({ startAt: '2026-03-02T12:00:00Z' }), now);
  await assert.rejects(updateSchedule(uid, a.id, { startAt: '2026-03-02T12:15:00Z' }, now), (e) => e.status === 409);
  await updateSchedule(uid, a.id, { startAt: '2026-03-02T10:15:00Z' }, now); // overlaps only its old self
});

test('start now works for a missed or upcoming session, but not while another is running', async () => {
  const uid = user();
  const missed = await createSchedule(uid, plan({ startAt: '2026-03-02T10:00:00Z' }), at('2026-03-02T09:00:00Z'));
  await processDueSchedules(uid, { now: at('2026-03-02T10:30:00Z') });
  assert.equal((await ScheduledSession.findById(missed.id)).status, 'missed');

  const { session } = await startScheduledNow(uid, missed.id);
  assert.equal(String(session.scheduledSessionId), missed.id);
  assert.equal((await ScheduledSession.findById(missed.id)).status, 'started');

  const later = await createSchedule(uid, plan({ startAt: new Date(Date.now() + 60 * MIN).toISOString() }));
  await assert.rejects(startScheduledNow(uid, later.id), (e) => e.status === 409);
  await assert.rejects(startScheduledNow(uid, missed.id), (e) => e.status === 409);
});

test('the next session is the earliest upcoming one', async () => {
  const uid = user();
  const now = at('2026-03-02T09:00:00Z');
  await createSchedule(uid, plan({ title: 'Later', startAt: '2026-03-02T12:00:00Z' }), now);
  await createSchedule(uid, plan({ title: 'Sooner', startAt: '2026-03-02T10:00:00Z' }), now);
  assert.equal((await nextOccurrence(uid, now)).title, 'Sooner');
  assert.equal(await nextOccurrence(user(), now), null);
});

test('"this and following" edit splits the series: earlier sessions keep the old settings', async () => {
  const uid = user();
  const now = at('2026-03-01T00:00:00Z');
  await createSchedule(uid, plan({ startAt: '2026-03-02T03:30:00Z', repeat: 'daily' }), now);
  const range = [at('2026-03-02T00:00:00Z'), at('2026-03-06T00:00:00Z'), now];

  const [, , third] = await listOccurrences(uid, ...range);
  await updateSchedule(uid, third.id, { startAt: '2026-03-04T04:30:00Z', plannedDuration: 60 }, now, { scope: 'following' });
  const list = await listOccurrences(uid, ...range);
  assert.deepEqual(list.map((o) => [o.startAt.toISOString().slice(0, 16), o.plannedDuration]), [
    ['2026-03-02T03:30', 30],
    ['2026-03-03T03:30', 30],
    ['2026-03-04T04:30', 60],
    ['2026-03-05T04:30', 60],
  ]);
});

test('"this and following" cancel keeps the earlier sessions', async () => {
  const uid = user();
  const now = at('2026-03-01T00:00:00Z');
  await createSchedule(uid, plan({ startAt: '2026-03-02T03:30:00Z', repeat: 'daily' }), now);
  const range = [at('2026-03-02T00:00:00Z'), at('2026-03-06T00:00:00Z'), now];

  const [, second] = await listOccurrences(uid, ...range);
  assert.deepEqual(await cancelSchedule(uid, second.id, now, { scope: 'following' }), { cancelled: 'following' });
  assert.deepEqual((await listOccurrences(uid, ...range)).map((o) => o.startAt.toISOString().slice(0, 10)), ['2026-03-02']);
});

// ── Live state (in-session counts from the extension) ──

const { updateLiveSession } = require('../controllers/sessionController');

async function liveUpdate(userId, body) {
  let payload;
  await updateLiveSession({ user: { _id: userId }, body }, { status() { return this; }, json(p) { payload = p; return this; } });
  return payload;
}

test('live updates turn the extension counts into Focused / Drifting / Distracted', async () => {
  const uid = user();
  const session = await FocusSession.create({ userId: uid, plannedDuration: 25 });
  const id = String(session._id);

  assert.equal((await liveUpdate(uid, { sessionId: id, tabSwitches: 0 })).liveStatus, 'low');
  assert.equal((await liveUpdate(uid, { sessionId: id, tabSwitches: 6, blockAttempts: 2 })).liveStatus, 'medium');
  const high = await liveUpdate(uid, { sessionId: id, tabSwitches: 12, interruptions: 4, blockAttempts: 5 });
  assert.equal(high.liveStatus, 'high');
  assert.deepEqual(high.counts, { tabSwitches: 12, interruptions: 4, blockAttempts: 5 });
});

test('live counts never go backwards (a restarted extension or the website sending nothing)', async () => {
  const uid = user();
  const session = await FocusSession.create({ userId: uid, plannedDuration: 25 });
  const id = String(session._id);
  await liveUpdate(uid, { sessionId: id, tabSwitches: 12, interruptions: 4, blockAttempts: 5 });

  const stale = await liveUpdate(uid, { sessionId: id, tabSwitches: 0, interruptions: 0, blockAttempts: 0 });
  assert.deepEqual(stale.counts, { tabSwitches: 12, interruptions: 4, blockAttempts: 5 });
  assert.equal(stale.liveStatus, 'high');
  // The website's own refresh sends no counts
  assert.equal((await liveUpdate(uid, { sessionId: id })).liveStatus, 'high');
  assert.equal((await FocusSession.findById(id)).distractionAttempts, 5);
});
