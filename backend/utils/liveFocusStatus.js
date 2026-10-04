/**
 * Live focus status shown during a running session (Focused / Drifting / Distracted).
 *
 * This is a plain rule over what has happened so far in the session, not a
 * machine-learning prediction. The decision tree only predicts before a
 * session starts; it never sees in-session counts.
 *
 * @param {{ tabSwitches?: number, interruptions?: number, blockAttempts?: number }} counts
 * @returns {'low'|'medium'|'high'} distraction level
 */
function liveFocusStatus({ tabSwitches = 0, interruptions = 0, blockAttempts = 0 } = {}) {
  const score =
    Math.max(0, 1 - blockAttempts / 5) * 40 +
    Math.max(0, 1 - tabSwitches / 10) * 30 +
    Math.max(0, 1 - interruptions / 8) * 30;

  if (score >= 70) return 'low';
  if (score >= 40) return 'medium';
  return 'high';
}

module.exports = { liveFocusStatus };
