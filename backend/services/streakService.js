/**
 * Focus streaks, computed from the sessions themselves in the user's timezone.
 *
 * A streak is the number of consecutive local calendar days, each with at
 * least one completed session, ending today — or ending yesterday, so a
 * streak isn't shown as broken before the user has had a chance to focus
 * today. Missing a whole day resets it to 0.
 *
 * The stored User.currentStreak used to be bumped on session end with the
 * server's (UTC) day boundaries and was never decreased, so it drifted for
 * users east/west of UTC and kept showing old streaks after a missed day.
 */

const FocusSession = require('../models/FocusSession');
const { zoneOr, localDayNumber, isValidTimezone } = require('../utils/timezone');

const DEFAULT_TZ = process.env.ML_DEFAULT_TIMEZONE || 'Asia/Kolkata';

/** The timezone to count days in: the one the client sent, else the latest session's. */
async function resolveTimezone(userId, requested) {
  if (requested && isValidTimezone(requested)) return requested;
  const latest = await FocusSession.findOne({ userId, timezone: { $nin: [null, ''] } })
    .sort({ startTime: -1 })
    .select('timezone')
    .lean();
  return zoneOr(latest?.timezone, DEFAULT_TZ);
}

/** Sorted, de-duplicated local day numbers of completed sessions. */
async function completedDays(userId, tz, { excludeSessionId } = {}) {
  const query = { userId, status: 'completed' };
  if (excludeSessionId) query._id = { $ne: excludeSessionId };
  const sessions = await FocusSession.find(query).select('startTime').lean();
  return [...new Set(sessions.map((s) => localDayNumber(s.startTime, tz)))].sort((a, b) => a - b);
}

/** Pure part, for tests: streak facts from a sorted list of day numbers. */
function streakFromDays(days, today) {
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const set = new Set(days);
  const endsToday = set.has(today);
  let cursor = endsToday ? today : set.has(today - 1) ? today - 1 : null;
  let current = 0;
  while (cursor !== null && set.has(cursor)) {
    current += 1;
    cursor -= 1;
  }
  return { current, longest, endsToday };
}

/**
 * @returns {Promise<{ current: number, longest: number, endsToday: boolean, timezone: string }>}
 */
async function computeStreak(userId, tz, { now = new Date(), excludeSessionId } = {}) {
  const zone = await resolveTimezone(userId, tz);
  const days = await completedDays(userId, zone, { excludeSessionId });
  return { ...streakFromDays(days, localDayNumber(now, zone)), timezone: zone };
}

/** Streak after a session completes today, given the streak just before it. */
function streakAfterCompletion(before) {
  if (before.endsToday) return before.current;
  return before.current > 0 ? before.current + 1 : 1;
}

/**
 * Bring the stored User streak fields in line with the computed values
 * (the coin streak bonus and the streak-alert notifications read them).
 */
async function syncUserStreak(user, tz) {
  const s = await computeStreak(user._id, tz);
  const longest = Math.max(user.longestStreak || 0, s.longest);
  if (user.currentStreak !== s.current || user.longestStreak !== longest) {
    user.currentStreak = s.current;
    user.longestStreak = longest;
    await user.constructor.updateOne({ _id: user._id }, { currentStreak: s.current, longestStreak: longest });
  }
  return s;
}

module.exports = { resolveTimezone, computeStreak, streakFromDays, streakAfterCompletion, syncUserStreak };
