/**
 * Prediction target — the ONE definition of a "successful" focus session.
 *
 * sessionSuccess = 1 when ALL of these observed facts hold, else 0:
 *   - the session ended with status 'completed' (not cancelled)
 *   - the user stayed for at least 90% of the time they planned
 *   - they tried to open a blocked site at most once
 *
 * It is computed only from what actually happened in the session. Nothing here
 * is used as a model feature, so the tree cannot re-learn this rule.
 *
 * Used by: featureBuilder.js (history rates), extractTrainingData.js (label),
 * sessionController.js (actual outcome at session end).
 */

const SUCCESS_RULE = Object.freeze({
  requiredStatus: 'completed',
  minDurationRatio: 0.9,
  maxDistractionAttempts: 1,
});

/** Statuses for which the outcome is known. Active sessions have no label yet. */
const ENDED_STATUSES = Object.freeze(['completed', 'cancelled']);

const hasEnded = (session) => ENDED_STATUSES.includes(session?.status);

/**
 * @param {{ status: string, duration?: number, plannedDuration: number, distractionAttempts?: number }} session
 * @returns {0|1}
 */
function isSessionSuccess(session) {
  if (!session || session.status !== SUCCESS_RULE.requiredStatus) return 0;
  const planned = Number(session.plannedDuration) || 0;
  if (planned <= 0) return 0;
  const duration = Number(session.duration) || 0;
  const distractions = Number(session.distractionAttempts) || 0;
  // The small tolerance absorbs float error (0.9 * 70 is 63.00000000000001)
  return duration >= SUCCESS_RULE.minDurationRatio * planned - 1e-9 &&
    distractions <= SUCCESS_RULE.maxDistractionAttempts
    ? 1
    : 0;
}

module.exports = { SUCCESS_RULE, ENDED_STATUSES, hasEnded, isSessionSuccess };
