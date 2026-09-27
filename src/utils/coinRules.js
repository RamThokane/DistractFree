/**
 * Focus Coin rules shared by the dashboard and the landing-page demo.
 * Mirrors backend/utils/coinCalculator.js — keep the two in sync.
 */

export const SESSION_PRESETS = [
  { label: '25 min (Pomodoro)', seconds: 25 * 60, coins: 10 },
  { label: '50 min (Deep Work)', seconds: 50 * 60, coins: 25 },
  { label: '90 min (Marathon)', seconds: 90 * 60, coins: 40 },
  { label: '120 min (Ultra)', seconds: 120 * 60, coins: 60 },
  { label: 'Custom', isCustom: true },
];

/** Coins deducted when a blocked website is unlocked. */
export const UNLOCK_COST = 5;

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

/** Same tiers, streak bonus and distraction penalty (5 % per attempt, max 50 %) as the backend. */
export const calculateCoins = (durationMinutes, currentStreak = 0, distractionAttempts = 0) => {
  const baseCoins = TIERS.find((tier) => durationMinutes >= tier.minMinutes)?.coins || 0;
  const streakMultiplier = STREAK_BONUSES.find((b) => currentStreak >= b.minDays)?.multiplier || 1.0;
  const distractionPenalty = Math.min(distractionAttempts * 0.05, 0.5);

  const afterStreak = Math.round(baseCoins * streakMultiplier);
  const totalCoins = Math.max(0, Math.round(afterStreak * (1 - distractionPenalty)));

  return { baseCoins, streakMultiplier, distractionPenalty, totalCoins };
};
