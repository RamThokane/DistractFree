/**
 * Compute a distraction score (0–100) from browsing logs.
 *
 * A higher score means the user is MORE distracted.
 *
 * Factors:
 *   1. Ratio of blocked-site visits to total site visits (weight 40 %)
 *   2. Time spent on blocked sites relative to total browsing time (weight 35 %)
 *   3. Frequency of context switches (weight 25 %)
 *
 * @param {Object[]} logs — array of BrowsingLog documents
 * @returns {{ score: number, breakdown: object }}
 */
const computeDistractionScore = (logs) => {
  if (!logs || logs.length === 0) {
    return { score: 0, breakdown: { visitRatio: 0, timeRatio: 0, switchRate: 0 } };
  }

  const totalVisits = logs.length;
  const blockedVisits = logs.filter((l) => l.wasBlocked).length;
  const totalDuration = logs.reduce((sum, l) => sum + (l.duration || 0), 0);
  const blockedDuration = logs
    .filter((l) => l.wasBlocked)
    .reduce((sum, l) => sum + (l.duration || 0), 0);

  // Context switches: count how many times the user alternated between blocked and non-blocked sites
  let switches = 0;
  for (let i = 1; i < logs.length; i++) {
    if (logs[i].wasBlocked !== logs[i - 1].wasBlocked) {
      switches++;
    }
  }

  // Normalise each factor to 0–1
  const visitRatio = totalVisits > 0 ? blockedVisits / totalVisits : 0;
  const timeRatio = totalDuration > 0 ? blockedDuration / totalDuration : 0;
  const maxSwitchesExpected = Math.max(totalVisits - 1, 1);
  const switchRate = switches / maxSwitchesExpected;

  // Weighted sum → 0–100
  const score = Math.round(
    (visitRatio * 40 + timeRatio * 35 + switchRate * 25)
  );

  return {
    score: Math.min(100, Math.max(0, score)),
    breakdown: {
      visitRatio: Math.round(visitRatio * 100),
      timeRatio: Math.round(timeRatio * 100),
      switchRate: Math.round(switchRate * 100),
    },
  };
};

module.exports = { computeDistractionScore };
