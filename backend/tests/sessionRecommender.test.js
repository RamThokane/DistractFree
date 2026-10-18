const test = require('node:test');
const assert = require('node:assert/strict');
const { recommendFromHistory, candidateStarts, MIN_SESSIONS } = require('../services/sessionRecommender');
const { localParts } = require('../utils/timezone');

const TZ = 'Asia/Kolkata';
// 10:00 IST on a Monday
const NOW = new Date('2026-10-19T04:30:00Z');

/** A session at `hourIst` local, `daysAgo` days back. */
function session(daysAgo, hourIst, planned, success) {
  const start = new Date(Date.UTC(2026, 9, 19 - daysAgo, hourIst, 0) - 5.5 * 3600000);
  return {
    startTime: start,
    endTime: new Date(start.getTime() + planned * 60000),
    plannedDuration: planned,
    duration: success ? planned : Math.round(planned * 0.3),
    status: success ? 'completed' : 'cancelled',
    distractionAttempts: 0,
    timezone: TZ,
  };
}

test('too little history → learning, with how many are needed', () => {
  const r = recommendFromHistory({ sessions: [session(1, 17, 40, true)], now: NOW, timezone: TZ });
  assert.equal(r.status, 'learning');
  assert.equal(r.needed, MIN_SESSIONS);
});

test('picks the hour and length the user actually succeeds at', () => {
  const sessions = [];
  // Evenings at 5 PM with 40 minutes go well; mornings and 120 minutes don't
  for (let d = 1; d <= 8; d++) sessions.push(session(d, 17, 40, true));
  for (let d = 1; d <= 6; d++) sessions.push(session(d, 9, 25, d % 3 === 0));
  for (let d = 1; d <= 4; d++) sessions.push(session(d, 14, 120, false));
  const r = recommendFromHistory({ sessions, now: NOW, timezone: TZ });
  assert.equal(r.status, 'ready');
  assert.equal(r.source, 'history');
  assert.equal(r.best.plannedDuration, 40);
  assert.equal(localParts(new Date(r.best.startAt), TZ).hour, 17);
  assert.match(r.best.headline, /40-min session at 5 PM/);
  assert.ok(r.best.successPercent > 60, r.best.successPercent);
  assert.ok(r.why.length >= 2);
});

test('never recommends a length the user has not tried (when tried ones exist)', () => {
  const sessions = [];
  for (let d = 1; d <= 10; d++) sessions.push(session(d, 18, 25, d % 2 === 0));
  const r = recommendFromHistory({ sessions, now: NOW, timezone: TZ });
  assert.equal(r.best.plannedDuration, 25);
});

test('uses the model score when one is supplied', () => {
  const sessions = [];
  for (let d = 1; d <= 10; d++) sessions.push(session(d, 18, 40, true));
  // A model that loves 90-minute sessions at 8 PM (but 90 is untried → still 40-min pool)
  const modelScore = ({ startTime, plannedDuration }) => (localParts(startTime, TZ).hour === 20 ? 0.9 : 0.5) - (plannedDuration === 40 ? 0 : 0.2);
  const r = recommendFromHistory({ sessions, now: NOW, timezone: TZ, modelScore });
  assert.equal(r.source, 'model');
  assert.equal(r.best.plannedDuration, 40);
  assert.equal(localParts(new Date(r.best.startAt), TZ).hour, 20);
  assert.equal(r.best.successPercent, 90);
});

test('candidates stay within the next 24 hours, on the hour, 6:00–22:00 local', () => {
  const starts = candidateStarts(NOW, TZ);
  assert.ok(starts[0].isNow);
  for (const s of starts.slice(1)) {
    const p = localParts(s.at, TZ);
    assert.equal(p.minute, 0);
    assert.ok(p.hour >= 6 && p.hour <= 22);
    assert.ok(s.at > NOW && s.at - NOW <= 24 * 3600000);
  }
});

test('sessions never run past local midnight', () => {
  const sessions = [];
  for (let d = 1; d <= 10; d++) sessions.push(session(d, 22, 120, true));
  const r = recommendFromHistory({ sessions, now: NOW, timezone: TZ });
  const start = localParts(new Date(r.best.startAt), TZ);
  assert.ok(start.hour * 60 + start.minute + r.best.plannedDuration <= 24 * 60);
});
