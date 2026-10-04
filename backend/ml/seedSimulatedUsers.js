/**
 * DistractFree — Simulated Users (demo / cold start only)
 * ========================================================
 *
 * Simulates a few user personas and writes raw FocusSession documents marked
 * `source: 'simulated'`. Useful for demos before enough real sessions exist.
 *
 * How outcomes are produced:
 *   Each persona has HIDDEN traits (how focused they are, when they peak, how
 *   long they can hold attention, how tempted they are by blocked sites, how
 *   much a good or bad run carries over). A session's outcome is drawn at
 *   random from those traits. The simulator writes only what the real app
 *   records — start/end time, planned and actual duration, status, tab
 *   switches, blocked-site attempts. It never reads or writes model features,
 *   and the label is later derived by the same ml/target.js rule as real data.
 *
 * Simulated sessions use made-up user ids with no User document, so they never
 * appear in auth, coins or the leaderboard. They are excluded from every
 * reported metric; training uses them only with `--include-simulated`.
 *
 * Usage:
 *   node ml/seedSimulatedUsers.js            replace simulated sessions with a fresh set
 *   node ml/seedSimulatedUsers.js --purge    remove all simulated sessions
 *   options: --days 60  --seed 7
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/**
 * Hidden traits per persona.
 *   focus        baseline log-odds of holding a session to the end
 *   peakHour     local hour they focus best at
 *   rhythm       how strongly distance from peakHour hurts
 *   stamina      minutes after which longer plans start to hurt
 *   temptation   blocked-site attempts per focused hour
 *   momentum     how much the previous session's outcome carries over
 *   sessionsPerDay, activeDays  how often they show up
 *   hours        local hours they tend to start at
 *   plans        planned durations they pick from
 */
const PERSONAS = [
  { name: 'early-bird', focus: 0.9, peakHour: 8, rhythm: 0.22, stamina: 50, temptation: 0.6, momentum: 0.5, sessionsPerDay: 2.2, activeDays: 0.8, hours: [6, 7, 8, 9, 10, 14], plans: [25, 45, 50] },
  { name: 'night-owl', focus: 0.4, peakHour: 23, rhythm: 0.18, stamina: 60, temptation: 1.2, momentum: 0.4, sessionsPerDay: 1.8, activeDays: 0.65, hours: [15, 20, 21, 22, 23, 0, 1], plans: [25, 50, 90] },
  { name: 'sprinter', focus: 0.6, peakHour: 11, rhythm: 0.08, stamina: 22, temptation: 0.9, momentum: 0.3, sessionsPerDay: 3.0, activeDays: 0.7, hours: [9, 11, 13, 16, 18], plans: [15, 25, 45] },
  { name: 'scroller', focus: -0.7, peakHour: 10, rhythm: 0.1, stamina: 30, temptation: 3.5, momentum: 0.8, sessionsPerDay: 1.5, activeDays: 0.5, hours: [10, 13, 17, 21, 23], plans: [15, 25] },
  { name: 'steady', focus: 1.3, peakHour: 14, rhythm: 0.05, stamina: 75, temptation: 0.3, momentum: 0.2, sessionsPerDay: 1.2, activeDays: 0.9, hours: [9, 13, 14, 15, 19], plans: [25, 45, 60] },
  { name: 'weekend-warrior', focus: 0.1, peakHour: 16, rhythm: 0.1, stamina: 45, temptation: 1.5, momentum: 0.6, sessionsPerDay: 2.5, activeDays: 0.35, weekendBoost: 1.1, hours: [11, 15, 16, 17, 20], plans: [25, 45, 90] },
];

/** Seeded PRNG (mulberry32) so a seed reproduces the same users. */
function makeRng(seed) {
  let a = seed;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (xs) => xs[Math.floor(next() * xs.length)];
  const normal = (mu = 0, sigma = 1) =>
    mu + sigma * Math.sqrt(-2 * Math.log(next() || 1e-12)) * Math.cos(2 * Math.PI * next());
  const poisson = (lambda) => {
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = next();
    while (p > limit) {
      k += 1;
      p *= next();
    }
    return k;
  };
  return { next, pick, normal, poisson };
}

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const hourDistance = (a, b) => Math.min(Math.abs(a - b), 24 - Math.abs(a - b));

/**
 * Simulate raw sessions for every persona.
 *
 * @param {object} [options]
 * @param {number} [options.days=60]   how far back the history goes
 * @param {number} [options.seed=7]
 * @param {Date}   [options.endDate=now]
 * @param {() => any} [options.newUserId] id factory (defaults to ObjectId)
 * @returns {object[]} FocusSession-shaped documents, oldest first
 */
function simulateSessions({ days = 60, seed = 7, endDate = new Date(), newUserId } = {}) {
  const rng = makeRng(seed);
  const makeId = newUserId || (() => new mongoose.Types.ObjectId());
  const dayZero = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()) - days * DAY;
  const sessions = [];

  for (const persona of PERSONAS) {
    const userId = makeId();
    let carry = 0; // hidden mood carried from the previous session

    for (let d = 0; d < days; d++) {
      const dayStart = dayZero + d * DAY;
      const weekend = [0, 6].includes(new Date(dayStart).getUTCDay());
      const showsUp = persona.activeDays + (weekend && persona.weekendBoost ? 0.5 : 0);
      if (rng.next() > showsUp) {
        carry *= 0.5;
        continue;
      }

      const dayMood = rng.normal(0, 0.6); // a good or bad day, unobserved
      const hours = [...new Set(Array.from({ length: Math.max(1, rng.poisson(persona.sessionsPerDay)) }, () => rng.pick(persona.hours)))]
        .sort((a, b) => a - b);

      for (const hour of hours) {
        const planned = rng.pick(persona.plans);
        // Simulated users are stored in UTC, so the local hour is the UTC hour
        const startTime = new Date(dayStart + hour * 60 * MINUTE + Math.floor(rng.next() * 50) * MINUTE);
        if (startTime >= endDate) continue;

        const logit =
          persona.focus +
          dayMood +
          persona.momentum * carry +
          (weekend ? persona.weekendBoost || 0 : 0) -
          persona.rhythm * hourDistance(hour, persona.peakHour) -
          Math.max(0, planned - persona.stamina) / 20;
        const holdsFocus = rng.next() < sigmoid(logit);

        // Sessions that fall apart end early; some are cancelled outright
        const fraction = holdsFocus ? 1 : Math.max(0.05, Math.min(0.85, rng.normal(0.45, 0.25)));
        const duration = Math.max(0, Math.round(planned * fraction));
        const cancelled = !holdsFocus && rng.next() < 0.45;

        const strain = holdsFocus ? 0.35 : 1.6; // temptation bites harder when focus is slipping
        const focusedHours = Math.max(duration, 5) / 60;

        sessions.push({
          userId,
          startTime,
          endTime: new Date(startTime.getTime() + Math.max(duration, 1) * MINUTE),
          plannedDuration: planned,
          duration,
          status: cancelled ? 'cancelled' : 'completed',
          distractionAttempts: rng.poisson(persona.temptation * strain * focusedHours),
          tabSwitches: rng.poisson((2 + persona.temptation * 3) * strain * focusedHours),
          interruptions: rng.poisson(0.8 * strain * focusedHours),
          coinsEarned: 0,
          timezone: 'UTC',
          source: 'simulated',
          notes: `simulated:${persona.name}`,
        });

        carry = holdsFocus ? 1 : -1;
      }
    }
  }

  return sessions.sort((a, b) => a.startTime - b.startTime);
}

async function main() {
  const args = process.argv.slice(2);
  const numberArg = (flag, fallback) => (args.includes(flag) ? Number(args[args.indexOf(flag) + 1]) : fallback);

  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in backend/.env');
  const FocusSession = require('../models/FocusSession');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

  try {
    const removed = await FocusSession.deleteMany({ source: 'simulated' });
    if (removed.deletedCount) console.log(`[ML] Removed ${removed.deletedCount} existing simulated sessions`);
    if (args.includes('--purge')) return;

    const sessions = simulateSessions({ days: numberArg('--days', 60), seed: numberArg('--seed', 7) });
    await FocusSession.insertMany(sessions);
    console.log(`[ML] Inserted ${sessions.length} simulated sessions for ${PERSONAS.length} personas`);
    console.log('     Train with them using: npm run ml:retrain -- --include-simulated');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[ML] Seeding failed:', err.message);
    process.exit(1);
  });
}

module.exports = { PERSONAS, simulateSessions };
