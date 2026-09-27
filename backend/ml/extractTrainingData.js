/**
 * DistractFree — Training Data Extraction
 * ========================================
 *
 * Builds ml/data/training_data.csv from real completed FocusSessions
 * (and their BrowsingLogs) in MongoDB. Pads with synthetic rows while
 * there is too little real data.
 *
 * Usage:
 *   node ml/extractTrainingData.js
 *   require('./ml/extractTrainingData').extractTrainingData()
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const mongoose = require('mongoose');
const FocusSession = require('../models/FocusSession');
const BrowsingLog = require('../models/BrowsingLog');

const CSV_PATH = path.join(__dirname, 'data', 'training_data.csv');
const MIN_REAL_ROWS = 50;
const PADDED_ROWS = 500;
const MIN_ROWS_PER_CLASS = 10; // train_model.py needs every class present for stratified CV

// Must match train_model.py / decisionTreeModel.js
const TIME_OF_DAY_MAP = { morning: 0, afternoon: 1, evening: 2, night: 3 };
const CATEGORY_MAP = {
  social_media: 0,
  entertainment: 1,
  news: 2,
  shopping: 3,
  gaming: 4,
  streaming: 5,
  messaging: 6,
  other: 7,
};
const RISK_LABELS = ['low', 'medium', 'high'];

const timeOfDayFromHour = (hour) => {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};

/** Convert one completed session + its browsing logs into a feature row. */
function sessionToRow(session, dominantCategory) {
  const duration = session.duration || 0;
  const planned = session.plannedDuration || 1;
  const distractionAttempts = session.distractionAttempts || 0;
  const tabSwitches = session.tabSwitches || 0;
  const interruptions = session.interruptions || 0;

  const focusScore = Math.round(Math.max(0, Math.min(100,
    (duration >= planned ? 40 : (duration / planned) * 40) +
    Math.max(0, 1 - distractionAttempts / 5) * 30 +
    Math.max(0, 1 - tabSwitches / 10) * 20 +
    Math.max(0, 1 - interruptions / 8) * 10
  )));

  const riskScore =
    distractionAttempts * 10 +
    tabSwitches * 3 +
    interruptions * 5 +
    (duration < 10 ? 20 : 0) +
    (focusScore < 40 ? 15 : 0);

  return {
    timeOfDay: TIME_OF_DAY_MAP[timeOfDayFromHour(new Date(session.startTime).getHours())],
    websiteCategory: CATEGORY_MAP[dominantCategory] ?? CATEGORY_MAP.other,
    sessionDuration: duration,
    previousDistractions: distractionAttempts,
    focusScore,
    distractionRisk: riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low',
    source: 'real',
  };
}

/** Seeded PRNG (mulberry32) so synthetic padding is reproducible. */
function makeRng(seed) {
  let a = seed;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const uniform = (lo, hi) => lo + next() * (hi - lo);
  const int = (lo, hiExcl) => Math.floor(uniform(lo, hiExcl));
  const normal = (mu, sigma) =>
    mu + sigma * Math.sqrt(-2 * Math.log(next() || 1e-12)) * Math.cos(2 * Math.PI * next());
  return { uniform, int, normal };
}

/** One synthetic row — same domain logic as the former generate_synthetic_dataset(). */
function syntheticRow(rng) {
  const times = Object.keys(TIME_OF_DAY_MAP);
  const cats = Object.keys(CATEGORY_MAP);
  const timeOfDay = times[rng.int(0, times.length)];
  const category = cats[rng.int(0, cats.length)];
  const sessionDuration = rng.int(5, 121);
  const previousDistractions = rng.int(0, 11);
  const focusScore = rng.int(10, 101);

  let risk = 0;
  if (timeOfDay === 'evening' || timeOfDay === 'night') risk += rng.uniform(20, 35);
  else if (timeOfDay === 'afternoon') risk += rng.uniform(5, 15);

  if (['social_media', 'gaming', 'streaming', 'entertainment'].includes(category)) risk += rng.uniform(15, 30);
  else if (['news', 'shopping'].includes(category)) risk += rng.uniform(5, 15);

  if (sessionDuration < 15) risk += rng.uniform(10, 20);
  else if (sessionDuration > 60) risk += rng.uniform(0, 10);

  risk += previousDistractions * rng.uniform(2, 5);
  risk += (100 - focusScore) * rng.uniform(0.2, 0.5);
  risk += rng.normal(0, 5);

  return {
    timeOfDay: TIME_OF_DAY_MAP[timeOfDay],
    websiteCategory: CATEGORY_MAP[category],
    sessionDuration,
    previousDistractions,
    focusScore,
    distractionRisk: risk >= 55 ? 'high' : risk >= 30 ? 'medium' : 'low',
    source: 'synthetic',
  };
}

async function loadRealRows() {
  const sessions = await FocusSession.find({ status: 'completed' })
    .select('startTime plannedDuration duration distractionAttempts tabSwitches interruptions')
    .lean();

  // Dominant BrowsingLog category per session, in one query
  const categoryAgg = await BrowsingLog.aggregate([
    { $match: { sessionId: { $in: sessions.map((s) => s._id) } } },
    { $group: { _id: { sessionId: '$sessionId', category: '$category' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $group: { _id: '$_id.sessionId', category: { $first: '$_id.category' } } },
  ]);
  const dominant = new Map(categoryAgg.map((c) => [String(c._id), c.category]));

  return sessions.map((s) => sessionToRow(s, dominant.get(String(s._id)) || 'other'));
}

/**
 * Extract real data from MongoDB, pad with synthetic rows if needed,
 * and write the training CSV.
 *
 * @returns {Promise<{ realRows: number, syntheticRows: number, classDistribution: object }>}
 */
async function extractTrainingData() {
  // Reuse the app's connection when called from the running server
  const ownConnection = mongoose.connection.readyState !== 1;
  if (ownConnection) {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in backend/.env');
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  }

  let realRows;
  try {
    realRows = await loadRealRows();
  } finally {
    if (ownConnection) await mongoose.disconnect();
  }

  const rng = makeRng(42);
  const synthetic = [];

  if (realRows.length < MIN_REAL_ROWS) {
    while (realRows.length + synthetic.length < PADDED_ROWS) synthetic.push(syntheticRow(rng));
    console.warn(
      `[ML] WARNING: only ${realRows.length} completed sessions (< ${MIN_REAL_ROWS}). ` +
      `Padded with ${synthetic.length} synthetic rows — the model is partially trained on ` +
      'synthetic data until more real sessions accumulate. Real rows are weighted 3x in training.'
    );
  }

  // Guarantee every class has enough samples for stratified split + 5-fold CV
  const count = (label) => [...realRows, ...synthetic].filter((r) => r.distractionRisk === label).length;
  for (const label of RISK_LABELS) {
    let needed = MIN_ROWS_PER_CLASS - count(label);
    for (let tries = 0; needed > 0 && tries < 100000; tries++) {
      const row = syntheticRow(rng);
      if (row.distractionRisk === label) {
        synthetic.push(row);
        needed--;
      }
    }
  }

  const rows = [...realRows, ...synthetic];
  const header = 'timeOfDay,websiteCategory,sessionDuration,previousDistractions,focusScore,distractionRisk,source';
  const lines = rows.map((r) =>
    [r.timeOfDay, r.websiteCategory, r.sessionDuration, r.previousDistractions, r.focusScore, r.distractionRisk, r.source].join(',')
  );
  fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
  fs.writeFileSync(CSV_PATH, `${header}\n${lines.join('\n')}\n`);

  const classDistribution = Object.fromEntries(RISK_LABELS.map((l) => [l, count(l)]));
  console.log(`[ML] Wrote ${rows.length} rows to ${CSV_PATH}`);
  console.log(`     Real rows:      ${realRows.length}`);
  console.log(`     Synthetic rows: ${synthetic.length}`);
  console.log(`     Class distribution: ${JSON.stringify(classDistribution)}`);

  return { realRows: realRows.length, syntheticRows: synthetic.length, classDistribution };
}

if (require.main === module) {
  extractTrainingData().catch((err) => {
    console.error('[ML] Extraction failed:', err.message);
    process.exit(1);
  });
}

module.exports = { extractTrainingData };
