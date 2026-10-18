const test = require('node:test');
const assert = require('node:assert/strict');
const { streakFromDays, streakAfterCompletion } = require('../services/streakService');
const { localDayNumber } = require('../utils/timezone');

const T = 20000; // "today" as a day number

test('no sessions → no streak', () => {
  assert.deepEqual(streakFromDays([], T), { current: 0, longest: 0, endsToday: false });
});

test('consecutive days ending today', () => {
  assert.deepEqual(streakFromDays([T - 2, T - 1, T], T), { current: 3, longest: 3, endsToday: true });
});

test('ending yesterday still counts (today not over yet)', () => {
  assert.equal(streakFromDays([T - 3, T - 2, T - 1], T).current, 3);
});

test('a missed day resets the current streak but not the longest', () => {
  const s = streakFromDays([T - 10, T - 9, T - 8, T - 7, T - 2], T);
  assert.equal(s.current, 0);
  assert.equal(s.longest, 4);
});

test('gap inside the history only counts the latest run', () => {
  assert.equal(streakFromDays([T - 5, T - 4, T - 2, T - 1, T], T).current, 3);
});

test('streak after completing a session today', () => {
  assert.equal(streakAfterCompletion({ current: 0, endsToday: false }), 1);
  assert.equal(streakAfterCompletion({ current: 4, endsToday: false }), 5); // ended yesterday
  assert.equal(streakAfterCompletion({ current: 4, endsToday: true }), 4); // second session today
});

test('days are counted in the user timezone, not UTC', () => {
  // 00:30 IST on Oct 19 is still Oct 18 in UTC
  const lateNight = new Date('2026-10-18T19:00:00Z');
  const evening = new Date('2026-10-18T12:00:00Z'); // 17:30 IST Oct 18
  assert.equal(localDayNumber(lateNight, 'Asia/Kolkata') - localDayNumber(evening, 'Asia/Kolkata'), 1);
  assert.equal(localDayNumber(lateNight, 'UTC') - localDayNumber(evening, 'UTC'), 0);
});
