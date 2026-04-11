/**
 * Coin calculation rules for focus sessions.
 *
 * Tiered system:
 *   0  – 14 min  →   0 coins
 *   15 – 24 min  →   5 coins
 *   25 – 49 min  →  10 coins
 *   50 – 89 min  →  25 coins
 *   90 – 119 min →  40 coins
 *   120+ min     →  60 coins
 *
 * Streak bonuses:
 *   3-day streak  → +20 %
 *   7-day streak  → +50 %
 *   30-day streak → +100 %
 *
 * Distraction penalty:
 *   Each distraction attempt during the session reduces coins by 5 %,
 *   up to a maximum penalty of 50 %.
 */

const TIERS = [
  { minMinutes: 120, coins: 60 },
  { minMinutes: 90, coins: 40 },
  { minMinutes: 50, coins: 25 },
  { minMinutes: 25, coins: 10 },
  { minMinutes: 15, coins: 5 },
];

const STREAK_BONUSES = [
  { minDays: 30, multiplier: 2.0 },
  { minDays: 7, multiplier: 1.5 },
  { minDays: 3, multiplier: 1.2 },
];

/**
 * Calculate the number of coins earned for a completed focus session.
 *
 * @param {number} durationMinutes — actual session length in minutes
 * @param {number} currentStreak   — user's current consecutive-day streak
 * @param {number} distractionAttempts — how many times the user tried to visit a blocked site
 * @returns {{ baseCoins: number, streakMultiplier: number, distractionPenalty: number, totalCoins: number }}
 */
const calculateCoins = (durationMinutes, currentStreak = 0, distractionAttempts = 0) => {
  // ── Base coins from tier ───────────────────────
  let baseCoins = 0;
  for (const tier of TIERS) {
    if (durationMinutes >= tier.minMinutes) {
      baseCoins = tier.coins;
      break;
    }
  }

  // ── Streak multiplier ─────────────────────────
  let streakMultiplier = 1.0;
  for (const bonus of STREAK_BONUSES) {
    if (currentStreak >= bonus.minDays) {
      streakMultiplier = bonus.multiplier;
      break;
    }
  }

  // ── Distraction penalty (5 % per attempt, max 50 %) ──
  const penaltyRate = Math.min(distractionAttempts * 0.05, 0.5);
  const distractionPenalty = penaltyRate;

  // ── Total ──────────────────────────────────────
  const afterStreak = Math.round(baseCoins * streakMultiplier);
  const totalCoins = Math.max(0, Math.round(afterStreak * (1 - distractionPenalty)));

  return {
    baseCoins,
    streakMultiplier,
    distractionPenalty,
    totalCoins,
  };
};

/**
 * Cost to unlock a blocked website during a focus session.
 */
const UNLOCK_COST = 10;

module.exports = { calculateCoins, UNLOCK_COST };
