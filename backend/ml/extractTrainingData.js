/**
 * DistractFree — Training Data Extraction
 * ========================================
 *
 * Builds ml/data/training_data.csv from finished FocusSessions in MongoDB.
 *
 * Each row is one session: the features known before it started (from the
 * shared feature builder), the derived model inputs (modelInputs.js, e.g. the
 * start hour as sin/cos) and whether it turned out successful (ml/target.js).
 *
 * Only real sessions are extracted unless simulated ones are asked for.
 * Simulated rows are marked in the `source` column; train_model.py may train
 * on them but never evaluates on them.
 *
 * Usage:
 *   node ml/extractTrainingData.js [--include-simulated]
 *   require('./ml/extractTrainingData').extractTrainingData({ includeSimulated })
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const mongoose = require('mongoose');
const FocusSession = require('../models/FocusSession');
const { ENDED_STATUSES } = require('./target');
const { buildTrainingRows } = require('./featureBuilder');
const { MODEL_INPUT_NAMES, toModelInputs } = require('./modelInputs');

const CSV_PATH = path.join(__dirname, 'data', 'training_data.csv');
const CSV_COLUMNS = ['userKey', 'startTime', 'source', ...MODEL_INPUT_NAMES, 'sessionSuccess'];

const toCsv = (rows) =>
  `${CSV_COLUMNS.join(',')}\n${rows.map((r) => CSV_COLUMNS.map((c) => r[c]).join(',')).join('\n')}\n`;

/**
 * Extract finished sessions from MongoDB and write the training CSV.
 *
 * @param {object}  [options]
 * @param {boolean} [options.includeSimulated=false]
 * @returns {Promise<{ realRows: number, simulatedRows: number, successRate: number|null }>}
 */
async function extractTrainingData({ includeSimulated = false } = {}) {
  // Reuse the app's connection when called from the running server
  const ownConnection = mongoose.connection.readyState !== 1;
  if (ownConnection) {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in backend/.env');
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  }

  let sessions;
  try {
    const filter = { status: { $in: ENDED_STATUSES } };
    if (!includeSimulated) filter.source = { $ne: 'simulated' };
    sessions = await FocusSession.find(filter)
      .select('userId startTime endTime plannedDuration duration status distractionAttempts tabSwitches timezone source')
      .lean();
  } finally {
    if (ownConnection) await mongoose.disconnect();
  }

  const rows = buildTrainingRows(sessions).map(toModelInputs);
  const real = rows.filter((r) => r.source === 'real');

  fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
  fs.writeFileSync(CSV_PATH, toCsv(rows));

  const summary = {
    realRows: real.length,
    simulatedRows: rows.length - real.length,
    successRate: real.length ? real.filter((r) => r.sessionSuccess === 1).length / real.length : null,
  };

  console.log(`[ML] Wrote ${rows.length} rows to ${CSV_PATH}`);
  console.log(`     Real rows:      ${summary.realRows}`);
  console.log(`     Simulated rows: ${summary.simulatedRows}`);
  if (summary.successRate !== null) {
    console.log(`     Real success rate: ${(summary.successRate * 100).toFixed(1)}%`);
  }

  return summary;
}

if (require.main === module) {
  extractTrainingData({ includeSimulated: process.argv.includes('--include-simulated') }).catch((err) => {
    console.error('[ML] Extraction failed:', err.message);
    process.exit(1);
  });
}

module.exports = { extractTrainingData, CSV_COLUMNS, toCsv };
