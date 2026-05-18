/**
 * Recommendation Service — Adaptive Behavioral Coaching Engine
 *
 * Generates personalized, data-driven recommendations from real user patterns.
 * Every recommendation is grounded in actual session performance, browsing behavior,
 * and ML predictions. No generic filler text.
 *
 * Recommendation categories:
 *   - Session Optimization
 *   - Distraction Control
 *   - Productivity Strategy
 *   - Behavioral Coaching
 */

// ═══════════════════════════════════════════════════
// RECOMMENDATION GENERATORS
// ═══════════════════════════════════════════════════

/**
 * Generate a full set of personalized recommendations from analytics data.
 *
 * @param {object} features       — from computeUserFeatures()
 * @param {object} productivity   — from getProductivityWindows()
 * @param {object} distraction    — from getHighDistractionHours()
 * @param {object} prediction     — from ML model
 * @param {object} trends         — from getTrendAnalytics()
 * @returns {object[]}            — array of recommendation cards
 */
function generateRecommendations(features, productivity, distraction, prediction, trends) {
  const recs = [];

  // ── Session Optimization ─────────────────────────
  if (features.totalSessions > 0) {
    // 1. Optimal session length
    if (productivity.optimalSessionLength && features.sessionDuration > 0) {
      const optimal = productivity.optimalSessionLength;
      const current = features.sessionDuration;

      if (current > optimal + 10) {
        recs.push({
          id: 'session_too_long',
          category: 'Session Optimization',
          icon: '⏱️',
          title: 'Optimal Session Length',
          description: `Your distraction risk increases after ${optimal} minutes. Try ${optimal}-minute sessions for peak focus.`,
          priority: 'high',
          metric: `${optimal} min`,
          metricLabel: 'Recommended',
        });
      } else if (current < optimal - 10 && current > 0) {
        recs.push({
          id: 'session_short',
          category: 'Session Optimization',
          icon: '📈',
          title: 'Extend Your Sessions',
          description: `Your average session is ${current} minutes, but your data shows you can focus well up to ${optimal} minutes. Try gradually increasing.`,
          priority: 'medium',
          metric: `${optimal} min`,
          metricLabel: 'Your sweet spot',
        });
      }
    }

    // 2. Strategic breaks based on distraction patterns
    if (features.tabSwitchCount > 3) {
      const breakInterval = Math.max(20, productivity.optimalSessionLength - 5);
      recs.push({
        id: 'strategic_breaks',
        category: 'Session Optimization',
        icon: '☕',
        title: 'Strategic Breaks',
        description: `Taking a 5-minute break every ${breakInterval} minutes reduces your tab-switching rate. Your current avg is ${features.tabSwitchCount} switches per session.`,
        priority: 'medium',
        metric: `${breakInterval} min`,
        metricLabel: 'Break interval',
      });
    }
  }

  // ── Productivity Strategy ────────────────────────
  if (productivity.hasSufficientData) {
    // 3. Morning power hours
    if (productivity.bestFocusBucket === 'morning' && productivity.bestCompletionRate >= 70) {
      recs.push({
        id: 'morning_power',
        category: 'Productivity Strategy',
        icon: '🎯',
        title: 'Morning Power Hours',
        description: `Your focus score peaks during ${productivity.bestFocusHours} with a ${productivity.bestCompletionRate}% completion rate. Schedule deep work during this window.`,
        priority: 'high',
        metric: productivity.bestFocusHours,
        metricLabel: 'Peak window',
      });
    } else if (productivity.bestFocusHours) {
      recs.push({
        id: 'peak_window',
        category: 'Productivity Strategy',
        icon: '🎯',
        title: 'Your Peak Focus Window',
        description: `You focus best during ${productivity.bestFocusHours} with a ${productivity.bestCompletionRate}% completion rate. Prioritize important tasks in this window.`,
        priority: 'high',
        metric: productivity.bestFocusHours,
        metricLabel: 'Best hours',
      });
    }

    // 4. Weakest hour warning
    if (productivity.weakestHours && productivity.weakestCompletionRate < 60) {
      recs.push({
        id: 'weak_hours',
        category: 'Productivity Strategy',
        icon: '⚠️',
        title: 'Low Productivity Window',
        description: `Your sessions during ${productivity.weakestHours} have only a ${productivity.weakestCompletionRate}% completion rate. Consider lighter tasks or shorter sessions during this period.`,
        priority: 'medium',
        metric: productivity.weakestHours,
        metricLabel: 'Weakest hours',
      });
    }
  }

  // ── Distraction Control ──────────────────────────
  if (distraction.hasSufficientData) {
    // 5. Distraction hotspot
    if (distraction.topRiskHours.length > 0 && distraction.topRiskHours[0].riskPercent > 30) {
      const peak = distraction.topRiskHours[0];
      recs.push({
        id: 'distraction_hotspot',
        category: 'Distraction Control',
        icon: '🛡️',
        title: 'Distraction Hotspot',
        description: `Your distraction risk peaks at ${peak.label} with ${peak.blockedAttempts} blocked-site attempts. Consider enabling strict mode during this window.`,
        priority: 'high',
        metric: `${peak.riskPercent}%`,
        metricLabel: 'Risk level',
      });
    }
  }

  // 6. Blocked site ratio
  if (features.blockedVisitRatio > 15) {
    recs.push({
      id: 'high_blocked_ratio',
      category: 'Distraction Control',
      icon: '🚫',
      title: 'Frequent Blocked Site Visits',
      description: `${features.blockedVisitRatio}% of your browsing hits blocked sites. Consider adding frequently visited distracting sites to your block list or enabling strict mode.`,
      priority: features.blockedVisitRatio > 30 ? 'high' : 'medium',
      metric: `${features.blockedVisitRatio}%`,
      metricLabel: 'Blocked ratio',
    });
  }

  // 7. Unlock spending
  if (features.unlockAttempts > 2) {
    recs.push({
      id: 'unlock_pattern',
      category: 'Distraction Control',
      icon: '🔓',
      title: 'Unlock Pattern Detected',
      description: `You've used ${features.unlockAttempts} coin unlocks this week. Pre-schedule short unlock breaks to stay in control without impulse spending.`,
      priority: 'medium',
      metric: `${features.unlockAttempts}`,
      metricLabel: 'Unlocks',
    });
  }

  // ── Behavioral Coaching ──────────────────────────
  // 8. Streak encouragement
  if (features.streakCount > 0 && features.streakCount < 7) {
    recs.push({
      id: 'streak_building',
      category: 'Behavioral Coaching',
      icon: '🔥',
      title: 'Build Your Streak',
      description: `You're on a ${features.streakCount}-day streak! Complete at least one session today to keep it going. Consistency compounds.`,
      priority: 'medium',
      metric: `${features.streakCount} days`,
      metricLabel: 'Current streak',
    });
  } else if (features.streakCount >= 7) {
    recs.push({
      id: 'streak_strong',
      category: 'Behavioral Coaching',
      icon: '🏆',
      title: 'Streak Champion',
      description: `Your ${features.streakCount}-day streak shows exceptional discipline. You're in the top tier of focused users.`,
      priority: 'low',
      metric: `${features.streakCount} days`,
      metricLabel: 'Streak',
    });
  }

  // 9. Consistency feedback
  if (trends && trends.consistencyScore < 50 && features.totalSessions > 0) {
    recs.push({
      id: 'low_consistency',
      category: 'Behavioral Coaching',
      icon: '📅',
      title: 'Improve Consistency',
      description: `You were active on ${Math.round(trends.consistencyScore)}% of the last 7 days. Even a short 10-minute session daily builds stronger habits than occasional long ones.`,
      priority: 'high',
      metric: `${trends.consistencyScore}%`,
      metricLabel: 'Consistency',
    });
  }

  // 10. Session completion feedback
  if (features.completionRate < 60 && features.totalSessions >= 3) {
    recs.push({
      id: 'low_completion',
      category: 'Behavioral Coaching',
      icon: '📉',
      title: 'Completion Rate Alert',
      description: `Only ${features.completionRate}% of your sessions complete. Try shorter planned durations — completing a 15-min session beats abandoning a 60-min one.`,
      priority: 'high',
      metric: `${features.completionRate}%`,
      metricLabel: 'Completion rate',
    });
  }

  // 11. Burnout detection
  if (features.totalSessions >= 5 && features.sessionDuration > 50 && features.completionRate < 50) {
    recs.push({
      id: 'burnout_risk',
      category: 'Behavioral Coaching',
      icon: '🧘',
      title: 'Burnout Risk Detected',
      description: `You're attempting long sessions (avg ${features.sessionDuration} min) but completing fewer than half. This pattern suggests burnout. Try 25-min sessions with proper breaks.`,
      priority: 'high',
      metric: 'High',
      metricLabel: 'Risk level',
    });
  }

  // Sort by priority: high first
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

  return recs;
}

/**
 * Generate the recommended session time and break time from real data.
 */
function getSessionRecommendation(features, productivity) {
  let recommendedSessionTime = 25;
  let suggestedBreakTime = 5;

  if (productivity.optimalSessionLength) {
    recommendedSessionTime = productivity.optimalSessionLength;
  }

  // Break scales with session length
  if (recommendedSessionTime >= 45) suggestedBreakTime = 10;
  else if (recommendedSessionTime >= 30) suggestedBreakTime = 7;
  else suggestedBreakTime = 5;

  return { recommendedSessionTime, suggestedBreakTime };
}

module.exports = {
  generateRecommendations,
  getSessionRecommendation,
};
