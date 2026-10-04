const test = require('node:test');
const assert = require('node:assert/strict');
const { isSessionSuccess, hasEnded, SUCCESS_RULE } = require('../ml/target');

const base = { status: 'completed', plannedDuration: 50, duration: 50, distractionAttempts: 0 };

test('a completed, full-length, undistracted session is a success', () => {
  assert.equal(isSessionSuccess(base), 1);
});

test('a cancelled session is never a success, however long it ran', () => {
  assert.equal(isSessionSuccess({ ...base, status: 'cancelled' }), 0);
});

test('an active session has no outcome yet', () => {
  assert.equal(isSessionSuccess({ ...base, status: 'active' }), 0);
  assert.equal(hasEnded({ status: 'active' }), false);
  assert.equal(hasEnded({ status: 'completed' }), true);
  assert.equal(hasEnded({ status: 'cancelled' }), true);
});

test('duration must reach 90% of the plan', () => {
  assert.equal(isSessionSuccess({ ...base, duration: 45 }), 1); // exactly 90%
  assert.equal(isSessionSuccess({ ...base, duration: 44 }), 0);
  // 0.9 * 70 is 63.00000000000001 in floating point; 63 minutes must still count
  assert.equal(isSessionSuccess({ ...base, plannedDuration: 70, duration: 63 }), 1);
});

test('at most one blocked-site attempt is allowed', () => {
  assert.equal(isSessionSuccess({ ...base, distractionAttempts: 1 }), 1);
  assert.equal(isSessionSuccess({ ...base, distractionAttempts: 2 }), 0);
});

test('missing or invalid fields do not count as success', () => {
  assert.equal(isSessionSuccess(null), 0);
  assert.equal(isSessionSuccess({ status: 'completed', plannedDuration: 0, duration: 0 }), 0);
  assert.equal(isSessionSuccess({ status: 'completed', plannedDuration: 25 }), 0); // no duration recorded
});

test('the rule is published as constants', () => {
  assert.deepEqual({ ...SUCCESS_RULE }, { requiredStatus: 'completed', minDurationRatio: 0.9, maxDistractionAttempts: 1 });
});
