/**
 * DistractFree — Scheduled retraining (run nightly by GitHub Actions)
 * ===================================================================
 *
 * The API runs on Vercel, which has no Python, so the in-server auto-retrain
 * (maybeAutoRetrain in trainModel.js) never fires in production. This script
 * does the same job from CI: when enough real sessions have finished since the
 * models were trained, it retrains both kinds (logistic regression and tree)
 * and reports whether the model files changed, so the workflow can commit
 * them and redeploy the API.
 *
 * Usage:
 *   node ml/scheduledRetrain.js [--force]
 *
 * Writes `retrained=true|false` to $GITHUB_OUTPUT when it is set.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const mongoose = require('mongoose');
const FocusSession = require('../models/FocusSession');
const { ENDED_STATUSES } = require('./target');
const { AUTO_RETRAIN_NEW_SESSIONS, retrainFromRealData } = require('./trainModel');
const { getModelState } = require('./activeModel');

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

/** Real sessions that ended after the current model was trained (all of them when there is none). */
async function countNewRealSessions(since) {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    const filter = { status: { $in: ENDED_STATUSES }, source: { $ne: 'simulated' } };
    if (since) filter.endTime = { $gt: since };
    return await FocusSession.countDocuments(filter);
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  const force = process.argv.includes('--force');
  const { trainedAt } = getModelState();
  const newSessions = await countNewRealSessions(trainedAt ? new Date(trainedAt) : null);
  console.log(`[ML] ${newSessions} real sessions finished since the model was trained (${trainedAt || 'never'})`);

  if (!force && newSessions < AUTO_RETRAIN_NEW_SESSIONS) {
    console.log(`[ML] Fewer than ${AUTO_RETRAIN_NEW_SESSIONS} new sessions — nothing to do`);
    setOutput('retrained', 'false');
    return;
  }

  for (const kind of ['logreg', 'tree']) {
    const result = await retrainFromRealData({ verbose: true, kind });
    if (!result.success) throw new Error(`${kind} training failed: ${result.error}`);
  }
  setOutput('retrained', 'true');
}

main().catch((err) => {
  console.error('\n❌ Scheduled retrain failed:', err.message);
  process.exit(1);
});
