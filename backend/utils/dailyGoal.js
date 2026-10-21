/**
 * The user's daily focus goal in minutes — the ONE place it is decided, so the
 * dashboard, the "Daily Goal Reached" notification, the coach and the weekly
 * report always use the same number.
 *
 * The goal set on the dashboard ("Set today's goal", user.dailyGoal) wins; the
 * older settings value is the fallback, then 120.
 */

const DEFAULT_GOAL_MINUTES = 120;

function goalMinutesFor(user) {
  return user?.dailyGoal?.focusMinutes || user?.settings?.dailyGoalMinutes || DEFAULT_GOAL_MINUTES;
}

module.exports = { DEFAULT_GOAL_MINUTES, goalMinutesFor };
