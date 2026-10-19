const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const FocusSession = require('../models/FocusSession');
const CoinTransaction = require('../models/CoinTransaction');
const WeeklyReport = require('../models/WeeklyReport');
const Notification = require('../models/Notification');
const gemini = require('../services/agent/geminiClient');
const mailer = require('../utils/mailer');
const {
  lastCompletedWeek, weekFromDate, computeWeekFacts, templateReport, sanitiseReport, nextSlotStart, getWeeklyReport,
} = require('../services/agent/weeklyReportService');
const { runScheduledChecks } = require('../services/notificationScheduler');

const TZ = 'Asia/Kolkata';
const MIN = 60 * 1000;
// Tuesday 20 Oct 2026, 12:00 in India → last week is Mon 12 – Sun 18 Oct
const NOW = new Date('2026-10-20T06:30:00Z');
let mongod;

test.before(async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'model-a';
  process.env.GEMINI_FALLBACK_MODELS = '';
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await WeeklyReport.syncIndexes();
});
test.after(async () => {
  gemini.setTransport();
  await mongoose.disconnect();
  await mongod.stop();
});
test.beforeEach(async () => {
  gemini.setTransport();
  process.env.GEMINI_API_KEY = 'test-key';
  await Promise.all([User.deleteMany({}), FocusSession.deleteMany({}), CoinTransaction.deleteMany({}), WeeklyReport.deleteMany({}), Notification.deleteMany({})]);
});

async function makeUser(overrides = {}) {
  const user = await User.create({ name: 'Asha Rao', email: `${new mongoose.Types.ObjectId()}@test.dev`, password: 'password123', ...overrides });
  // createdAt is set by timestamps; backdate it so last week counts
  await User.collection.updateOne({ _id: user._id }, { $set: { createdAt: overrides.createdAt || new Date('2026-09-01T00:00:00Z') } });
  return user;
}

function addSession(userId, startIso, { planned, duration = planned, status = 'completed', distractions = 0 }) {
  const startTime = new Date(startIso);
  return FocusSession.create({
    userId, startTime, endTime: new Date(startTime.getTime() + Math.max(duration, 1) * MIN),
    plannedDuration: planned, duration, status, distractionAttempts: distractions, timezone: TZ,
  });
}

/** The week used by most tests, built by hand (times in IST, +05:30). */
async function seedWeek(userId) {
  await addSession(userId, '2026-10-12T09:00:00+05:30', { planned: 50 });                     // Mon, went to plan
  await addSession(userId, '2026-10-12T15:00:00+05:30', { planned: 25, distractions: 2 });    // Mon, too many attempts
  await addSession(userId, '2026-10-14T09:00:00+05:30', { planned: 50, duration: 10, status: 'cancelled' }); // Wed, ended early
  await addSession(userId, '2026-10-17T09:30:00+05:30', { planned: 40 });                     // Sat, went to plan
  await addSession(userId, '2026-10-18T23:30:00+05:30', { planned: 30 });                     // Sun night: still this week
  await addSession(userId, '2026-10-19T00:30:00+05:30', { planned: 45 });                     // Mon after: next week
  await addSession(userId, '2026-10-06T10:00:00+05:30', { planned: 60 });                     // the week before
  await CoinTransaction.create({ userId, type: 'earned', amount: 10, balanceAfter: 30, description: 'Session completed', createdAt: new Date('2026-10-12T10:00:00+05:30') });
  await CoinTransaction.create({ userId, type: 'spent', amount: -5, balanceAfter: 25, description: 'Unlocked youtube.com during focus session', createdAt: new Date('2026-10-14T09:05:00+05:30') });
  await CoinTransaction.create({ userId, type: 'bonus', amount: 20, balanceAfter: 20, description: 'Welcome bonus', createdAt: new Date('2026-10-01T10:00:00+05:30') });
}

const geminiReply = (obj) => {
  const calls = [];
  gemini.setTransport(async ({ body }) => {
    calls.push(body);
    return { candidates: [{ content: { role: 'model', parts: [{ text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] } }] };
  });
  return calls;
};

const GOOD = {
  headline: 'A solid week: 2 h 25 min of focus, mostly in the mornings.',
  wins: ['3 of 5 sessions went to plan.', 'Monday was your best day.'],
  slips: ['One session ended early on Wednesday.'],
  goal: { text: 'Focus on 4 days this week, starting at 9 AM.', suggestedSlot: { weekday: 3, hour: 9, plannedDuration: 40 } },
};

// ── Weeks ──────────────────────────────────────────

test('last week is the previous Monday to Sunday in the user\'s timezone', () => {
  const w = lastCompletedWeek(NOW, TZ);
  assert.equal(w.start.toISOString(), '2026-10-11T18:30:00.000Z'); // Mon 12 Oct 00:00 IST
  assert.equal(w.end.toISOString(), '2026-10-18T18:30:00.000Z');   // Mon 19 Oct 00:00 IST
  // On a Monday morning, last week has only just ended
  const monday = lastCompletedWeek(new Date('2026-10-19T00:30:00+05:30'), TZ);
  assert.equal(monday.start.toISOString(), w.start.toISOString());
  assert.equal(weekFromDate('2026-10-12', TZ).start.toISOString(), w.start.toISOString());
  assert.equal(weekFromDate('2026-10-13', TZ), null); // a Tuesday
  assert.equal(weekFromDate('nope', TZ), null);
});

// ── Facts (checked by hand) ────────────────────────

test('week facts match a hand count', async () => {
  const user = await makeUser();
  await seedWeek(user._id);
  const f = await computeWeekFacts(user._id, lastCompletedWeek(NOW, TZ), TZ, { now: NOW });

  assert.equal(f.weekStart, '2026-10-12');
  assert.equal(f.weekLabel, '12 Oct – 18 Oct');
  assert.equal(f.sessions, 5);            // Mon×2, Wed, Sat, Sun night (not the Monday after)
  assert.equal(f.completedSessions, 4);
  assert.equal(f.endedEarly, 1);
  assert.equal(f.focusMinutes, 145);      // 50 + 25 + 40 + 30
  assert.equal(f.previousWeekFocusMinutes, 60);
  assert.equal(f.changePercent, 142);     // (145 − 60) / 60 = 141.7%
  assert.equal(f.wentToPlan, 3);          // Mon 9:00, Sat, Sun
  assert.equal(f.wentToPlanPercent, 60);
  assert.equal(f.avgSessionMinutes, 36);  // 145 / 4 = 36.25
  assert.equal(f.daysFocused, 3);         // Mon, Sat, Sun
  assert.deepEqual(f.bestDay, { day: 'Monday', date: '2026-10-12', focusMinutes: 75 });
  assert.deepEqual(f.bestStartHour, { hour: 9, label: '9 AM', wentToPlan: 2, sessions: 3 });
  assert.equal(f.blockedAttempts, 2);
  assert.equal(f.coinsEarned, 10);
  assert.equal(f.coinsSpent, 5);
  assert.equal(f.coinUnlocks, 1);
  assert.equal(f.perDay.length, 7);
  assert.equal(f.perDay[0].day, 'Monday');
  assert.equal(f.perDay[6].focusMinutes, 30);
});

// ── Report text ────────────────────────────────────

test('model output is checked: bad slots dropped, markdown stripped, missing parts rejected', () => {
  const r = sanitiseReport({ ...GOOD, headline: '**Great** week', wins: ['a', 'b', 'c', 'd'], goal: { text: 'Go', suggestedSlot: { weekday: 9, hour: 9, plannedDuration: 40 } } });
  assert.equal(r.headline, 'Great week');
  assert.equal(r.wins.length, 3);
  assert.equal(r.goal.suggestedSlot, null);
  assert.equal(sanitiseReport({ wins: [], slips: [], goal: { text: 'x' } }), null);
  assert.equal(sanitiseReport('nope'), null);
});

test('the template report is built from the facts alone', () => {
  const r = templateReport({ sessions: 0, weekLabel: '12 Oct – 18 Oct' });
  assert.match(r.headline, /No focus sessions/);
  const full = templateReport({ sessions: 5, focusMinutes: 145, daysFocused: 3, changePercent: 142, bestDay: { day: 'Monday', focusMinutes: 75 }, endedEarly: 1, coinUnlocks: 1, wentToPlanPercent: 60, bestStartHour: { hour: 9, label: '9 AM' }, avgSessionMinutes: 36 });
  assert.equal(full.headline, '2 h 25 min of focus in 5 sessions, 60% went to plan.');
  assert.ok(full.wins.some((w) => /142% more/.test(w)));
  assert.ok(full.slips.some((s) => /1 session ended early/.test(s)));
  assert.equal(full.goal.suggestedSlot.hour, 9);
});

test('a suggested slot becomes the next matching start time', () => {
  // Wednesday 9 AM after Tue 20 Oct noon → Wed 21 Oct 09:00 IST
  assert.equal(nextSlotStart({ weekday: 3, hour: 9 }, TZ, NOW), '2026-10-21T03:30:00.000Z');
  // Any day at 9 AM → tomorrow, since 9 AM today has passed
  assert.equal(nextSlotStart({ weekday: null, hour: 9 }, TZ, NOW), '2026-10-21T03:30:00.000Z');
  // Tuesday 3 PM → later today
  assert.equal(nextSlotStart({ weekday: 2, hour: 15 }, TZ, NOW), '2026-10-20T09:30:00.000Z');
});

// ── Generating and storing ─────────────────────────

test('the report is written by Gemini from the facts, stored, and generated only once', async () => {
  const user = await makeUser();
  await seedWeek(user._id);
  const calls = geminiReply(GOOD);

  const r = await getWeeklyReport(user._id, { timezone: TZ, now: NOW });
  assert.equal(r.status, 'ready');
  assert.equal(r.source, 'gemini');
  assert.equal(r.report.headline, GOOD.headline);
  assert.equal(r.report.goal.suggestedSlot.startAt, '2026-10-21T03:30:00.000Z');
  assert.equal(r.facts.focusMinutes, 145);
  // Structured output was requested and the facts were sent
  assert.equal(calls[0].generationConfig.responseMimeType, 'application/json');
  assert.match(calls[0].contents[0].parts[0].text, /"focusMinutes":145/);

  const again = await getWeeklyReport(user._id, { timezone: TZ, now: NOW });
  assert.equal(again.report.headline, GOOD.headline);
  assert.equal(calls.length, 1);
  assert.equal(await WeeklyReport.countDocuments({ userId: user._id }), 1);
});

test('unusable JSON or a Gemini failure falls back to the template', async () => {
  const user = await makeUser();
  await seedWeek(user._id);
  geminiReply('this is not json');
  const r = await getWeeklyReport(user._id, { timezone: TZ, now: NOW });
  assert.equal(r.source, 'template');
  assert.match(r.report.headline, /2 h 25 min/);

  const other = await makeUser();
  await seedWeek(other._id);
  gemini.setTransport(async () => { throw new gemini.GeminiError('down', { status: 503, retryable: true }); });
  assert.equal((await getWeeklyReport(other._id, { timezone: TZ, now: NOW })).source, 'template');
});

test('without a Gemini key the template report still works', async () => {
  delete process.env.GEMINI_API_KEY;
  const user = await makeUser();
  await seedWeek(user._id);
  const r = await getWeeklyReport(user._id, { timezone: TZ, now: NOW });
  assert.equal(r.status, 'ready');
  assert.equal(r.source, 'template');
});

test('two requests at once generate the report only once', async () => {
  const user = await makeUser();
  await seedWeek(user._id);
  let count = 0;
  gemini.setTransport(async () => {
    count++;
    await new Promise((r) => setTimeout(r, 100));
    return { candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(GOOD) }] } }] };
  });
  const [a, b] = await Promise.all([
    getWeeklyReport(user._id, { timezone: TZ, now: NOW }),
    getWeeklyReport(user._id, { timezone: TZ, now: NOW }),
  ]);
  assert.equal(count, 1);
  assert.deepEqual([a.status, b.status].sort(), ['generating', 'ready']);
});

test('no report for a week before the account existed, or for weeks out of range', async () => {
  const user = await makeUser({ createdAt: new Date('2026-10-19T10:00:00Z') });
  assert.equal((await getWeeklyReport(user._id, { timezone: TZ, now: NOW })).status, 'none');
  const old = await makeUser();
  assert.equal((await getWeeklyReport(old._id, { timezone: TZ, now: NOW, weekStart: '2026-10-19' })).status, 'none'); // not over yet
  assert.equal((await getWeeklyReport(old._id, { timezone: TZ, now: NOW, weekStart: '2026-01-05' })).status, 'none'); // too old
  assert.equal(await WeeklyReport.countDocuments({}), 0);
});

test('the report is emailed once, and only to users who turned it on', async () => {
  const sent = [];
  const original = mailer.sendEmail;
  mailer.sendEmail = async (msg) => { sent.push(msg); return { delivered: true }; };
  try {
    geminiReply(GOOD);
    const off = await makeUser();
    await seedWeek(off._id);
    await getWeeklyReport(off._id, { timezone: TZ, now: NOW });
    assert.equal(sent.length, 0);

    const on = await makeUser({ settings: { notifications: { weeklyReportEmail: true } } });
    await seedWeek(on._id);
    await getWeeklyReport(on._id, { timezone: TZ, now: NOW });
    await getWeeklyReport(on._id, { timezone: TZ, now: NOW });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, on.email);
    assert.match(sent[0].subject, /12 Oct – 18 Oct/);
    assert.match(sent[0].text, /Focus time: 2 h 25 min/);
    assert.match(sent[0].text, new RegExp(GOOD.goal.text));
  } finally {
    mailer.sendEmail = original;
  }
});

test('the weekly notification uses the report headline, once per week', async () => {
  const user = await makeUser();
  await seedWeek(user._id);
  geminiReply(GOOD);
  await runScheduledChecks(user._id, TZ, { now: NOW });
  await runScheduledChecks(user._id, TZ, { now: NOW });
  const notes = await Notification.find({ userId: user._id, type: 'weekly_report' }).lean();
  assert.equal(notes.length, 1);
  assert.match(notes[0].message, new RegExp(GOOD.headline.slice(0, 20)));
});

test('the daily cron emails opted-in users, and refuses calls without CRON_SECRET', async () => {
  const { runWeeklyEmails } = require('../controllers/agentController');
  const call = async (authorization) => {
    let status = 200;
    let body;
    await runWeeklyEmails({ headers: { authorization } }, {
      status(code) { status = code; return this; },
      json(p) { body = p; return this; },
    });
    return { status, body };
  };
  const sent = [];
  const original = mailer.sendEmail;
  mailer.sendEmail = async (msg) => { sent.push(msg); return { delivered: true }; };
  try {
    geminiReply(GOOD);
    const on = await makeUser({ settings: { notifications: { weeklyReportEmail: true } } });
    await seedWeek(on._id);
    await makeUser(); // opted out

    delete process.env.CRON_SECRET;
    assert.equal((await call('Bearer anything')).status, 401);
    process.env.CRON_SECRET = 'cron-secret-123';
    assert.equal((await call('Bearer wrong')).status, 401);
    assert.equal((await call(undefined)).status, 401);

    const ok = await call('Bearer cron-secret-123');
    assert.equal(ok.status, 200);
    assert.equal(ok.body.users, 1);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, on.email);
  } finally {
    mailer.sendEmail = original;
    delete process.env.CRON_SECRET;
  }
});

test('turning email on after the report exists still sends it once', async () => {
  const sent = [];
  const original = mailer.sendEmail;
  mailer.sendEmail = async (msg) => { sent.push(msg); return { delivered: true }; };
  try {
    geminiReply(GOOD);
    const user = await makeUser();
    await seedWeek(user._id);
    await getWeeklyReport(user._id, { timezone: TZ, now: NOW });
    assert.equal(sent.length, 0);
    await User.updateOne({ _id: user._id }, { $set: { 'settings.notifications.weeklyReportEmail': true } });
    await getWeeklyReport(user._id, { timezone: TZ, now: NOW });
    await getWeeklyReport(user._id, { timezone: TZ, now: NOW });
    assert.equal(sent.length, 1);
  } finally {
    mailer.sendEmail = original;
  }
});
