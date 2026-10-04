/**
 * DistractFree — ML Training Orchestrator (Node.js)
 * ===================================================
 *
 * This module provides a Node.js interface to trigger the Python
 * scikit-learn training pipelines and verify the exported model.
 *
 * Two model kinds (see activeModel.js):
 *   logreg  logistic regression — train_model.py (default)
 *   tree    decision tree       — train_tree.py
 *
 * Usage:
 *   node ml/trainModel.js [--tree] [--include-simulated]  — extract + train from CLI
 *                                                           (npm run ml:retrain / ml:retrain:tree)
 *   require('./ml/trainModel')                            — use programmatically
 *
 * Full pipeline (retrainFromRealData): extract finished sessions from MongoDB
 * (extractTrainingData.js) → write CSV → train in Python → validate JSON →
 * hot-reload the model. Metrics are always computed on real sessions only.
 *
 * The Python scripts handle the actual training. This wrapper handles
 * process spawning, output streaming, and post-training validation of the
 * exported JSON model, including a parity check: Node re-predicts sessions
 * Python already scored and must agree with it exactly.
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ML_DIR = __dirname;
const MODEL_DIR = path.join(ML_DIR, 'model');
const { extractTrainingData } = require('./extractTrainingData');
const tree = require('./decisionTreeModel');
const logreg = require('./logisticRegressionModel');
const { MIN_REAL_SESSIONS, requestedKind, kindOf, getActiveModel, getModelState, reload } = require('./activeModel');
const { FEATURE_NAMES } = require('./featureBuilder');
const { MODEL_INPUT_NAMES } = require('./modelInputs');

// Retrain automatically once this many new real sessions exist since the last training
const AUTO_RETRAIN_NEW_SESSIONS = 25;
// A failed attempt (e.g. Python missing) is not retried on every session end
const AUTO_RETRAIN_COOLDOWN_MS = 10 * 60 * 1000;

let retraining = false;
let lastAutoAttempt = 0;

const vectorToFeatures = (names, vector) => Object.fromEntries(names.map((name, i) => [name, vector[i]]));

/** Node's answer for a sample Python already scored. Null when they agree. */
function parityMismatch(result, sample, what) {
  if (result.predictedClass === sample.predictedClass && Math.abs(result.probability - sample.probability) <= 1e-9) return null;
  return `Node.js inference disagrees with scikit-learn on a ${what} ` +
    `(node: ${result.probability}/${result.predictedClass}, python: ${sample.probability}/${sample.predictedClass}).`;
}

/**
 * Per kind: the Python script, what it writes, and how to check the export.
 * checkParity returns an error message, or null when Node and Python agree.
 */
const TRAINERS = {
  logreg: {
    name: 'Logistic regression',
    script: path.join(ML_DIR, 'train_model.py'),
    modelPath: logreg.MODEL_PATH,
    reportPath: path.join(MODEL_DIR, 'training_report.json'),
    isCompatible: logreg.isCompatible,
    // Samples carry every MODEL_INPUT_NAMES column as written to the CSV, and
    // are re-derived here from the raw features, so the hour transform is checked too
    checkParity(modelJson) {
      for (const sample of modelJson.paritySamples || []) {
        const result = logreg.predict(vectorToFeatures(MODEL_INPUT_NAMES, sample.inputs), modelJson);
        const error = parityMismatch(result, sample, 'training session');
        if (error) return error;
      }
      return null;
    },
    summary: (m) => ({ version: m.version, trainedAt: m.trainedAt, features: m.featureNames, C: m.C, nParity: (m.paritySamples || []).length }),
  },
  tree: {
    name: 'Decision tree',
    script: path.join(ML_DIR, 'train_tree.py'),
    modelPath: tree.MODEL_PATH,
    reportPath: path.join(MODEL_DIR, 'tree_training_report.json'),
    isCompatible: tree.isCompatible,
    checkParity(modelJson) {
      for (const sample of modelJson.parity_samples || []) {
        const result = tree.predictWithPath(vectorToFeatures(FEATURE_NAMES, sample.features), modelJson);
        const error = parityMismatch(result, sample, 'test session');
        if (error) return error;
      }
      return null;
    },
    summary: (m) => ({
      version: m.model_version,
      trainedAt: m.trained_at,
      nodes: m.n_nodes,
      maxDepth: m.max_depth,
      features: m.feature_names,
      nParity: (m.parity_samples || []).length,
    }),
  },
};

/**
 * Locate the Python executable — tries python3, python, py in order.
 * @returns {string} path to python binary
 */
function findPython() {
  const candidates = process.platform === 'win32'
    ? ['python', 'python3', 'py']
    : ['python3', 'python'];

  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'pipe' });
      return cmd;
    } catch {
      // not found, try next
    }
  }

  throw new Error(
    'Python not found. Install Python 3.8+ and ensure it is on PATH.\n' +
    'Required packages: pip install -r ml/requirements.txt'
  );
}

/**
 * The latest training report (metrics, baselines, importances) for a model
 * kind, or null. Defaults to the kind currently answering predictions.
 * @param {'logreg'|'tree'} [kind]
 * @returns {object|null}
 */
function getTrainingReport(kind = kindOf(getActiveModel()) || requestedKind()) {
  try {
    return JSON.parse(fs.readFileSync(TRAINERS[kind].reportPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Run a Python training pipeline.
 *
 * @param {object} [options]
 * @param {boolean} [options.verbose=true]  — stream Python stdout/stderr
 * @param {number}  [options.timeout=120000] — max training time (ms)
 * @param {boolean} [options.includeSimulated=false] — also train on simulated sessions
 * @param {'logreg'|'tree'} [options.kind]  — defaults to ML_MODEL
 * @returns {Promise<{ success: boolean, trained?: boolean, report?: object, error?: string }>}
 */
async function trainModel(options = {}) {
  const { verbose = true, timeout = 120000, includeSimulated = false, kind = requestedKind() } = options;
  const trainer = TRAINERS[kind];
  if (!trainer) throw new Error(`Unknown model kind: ${kind}`);

  console.log('═'.repeat(60));
  console.log(`DistractFree — ML Training Orchestrator (${trainer.name})`);
  console.log('═'.repeat(60));

  // ── 1. Check prerequisites ───────────────────────
  console.log('\n[1/4] Checking prerequisites…');

  if (!fs.existsSync(trainer.script)) {
    throw new Error(`Training script not found: ${trainer.script}`);
  }

  const python = findPython();
  console.log(`      Python binary: ${python}`);

  // Ensure model output directory exists
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
    console.log(`      Created model directory: ${MODEL_DIR}`);
  }

  // ── 2. Spawn Python training process ─────────────
  console.log('\n[2/4] Starting Python training pipeline…\n');

  const args = [trainer.script, '--min-real', String(MIN_REAL_SESSIONS)];
  if (includeSimulated) args.push('--include-simulated');

  return new Promise((resolve, reject) => {
    const child = spawn(python, args, {
      cwd: ML_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      timeout,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (verbose) process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      if (verbose) process.stderr.write(text);
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return resolve({
          success: false,
          error: `Python process exited with code ${code}.\n${stderr || stdout}`,
        });
      }

      const report = getTrainingReport(kind);

      // Too little real data: Python deliberately trained nothing
      if (report?.status === 'insufficient_data') {
        console.log(`\n[ML] Not enough real sessions yet (${report.n_real}/${report.min_real_sessions}). No model trained.\n`);
        return resolve({ success: true, trained: false, report });
      }

      // ── 3. Validate exported model ─────────────────
      console.log('\n[3/4] Validating exported model…');

      if (!fs.existsSync(trainer.modelPath)) {
        return resolve({
          success: false,
          error: 'Training completed but model JSON was not exported.',
        });
      }

      let modelJson;
      try {
        modelJson = JSON.parse(fs.readFileSync(trainer.modelPath, 'utf-8'));
      } catch (parseErr) {
        return resolve({
          success: false,
          error: `Model JSON is invalid: ${parseErr.message}`,
        });
      }

      if (!trainer.isCompatible(modelJson)) {
        return resolve({
          success: false,
          error: 'Model JSON does not match the feature builder (feature names or parameter arrays differ).',
        });
      }

      const parityError = trainer.checkParity(modelJson);
      if (parityError) {
        return resolve({ success: false, error: parityError });
      }

      const meta = trainer.summary(modelJson);
      console.log(`      Model version: ${meta.version}`);
      console.log(`      Node.js and scikit-learn agree on ${meta.nParity} sessions`);

      // ── 4. Summarise the report ────────────────────
      console.log('\n[4/4] Results on held-out real sessions');
      if (report?.metrics) {
        console.log(`      Model accuracy: ${(report.metrics.accuracy * 100).toFixed(1)}%`);
        for (const [name, m] of Object.entries(report.baselines || {})) {
          console.log(`      Baseline ${name}: ${(m.accuracy * 100).toFixed(1)}%`);
        }
      }

      console.log('\n✅ Model training and validation complete!\n');

      resolve({
        success: true,
        trained: true,
        kind,
        modelPath: trainer.modelPath,
        report,
        modelMeta: { kind, ...meta },
      });
    });
  });
}

/**
 * Full pipeline: extract sessions from MongoDB → write CSV → train → validate,
 * then hot-reload the model used for predictions.
 *
 * @param {object} [options] — passed through to trainModel(); `includeSimulated` also applies
 *                             to extraction, `kind` defaults to ML_MODEL
 * @returns {Promise<{ success: boolean, trained?: boolean, busy?: boolean, report?: object, dataset?: object, error?: string }>}
 */
async function retrainFromRealData(options = {}) {
  if (retraining) return { success: false, busy: true, error: 'Retraining already in progress' };

  retraining = true;
  try {
    const kind = options.kind || requestedKind();
    const dataset = await extractTrainingData({ includeSimulated: options.includeSimulated });
    const result = await trainModel({ ...options, kind });
    if (result.success && result.trained) reload(kind);
    return { ...result, dataset };
  } finally {
    retraining = false;
  }
}

/**
 * Learning loop: retrain in the background once enough new real sessions have
 * finished since the model was trained. Called after each session ends.
 *
 * Skipped on Vercel (no Python, read-only filesystem) and when
 * ML_AUTO_RETRAIN=false. Never throws.
 *
 * @param {(since: Date|null) => Promise<number>} countNewRealSessions
 */
async function maybeAutoRetrain(countNewRealSessions) {
  if (retraining || process.env.VERCEL || process.env.ML_AUTO_RETRAIN === 'false') return;
  if (Date.now() - lastAutoAttempt < AUTO_RETRAIN_COOLDOWN_MS) return;

  try {
    const { kind, trainedAt } = getModelState();
    // With no model yet, count every real session and wait for the minimum-data guard
    const newSessions = await countNewRealSessions(trainedAt ? new Date(trainedAt) : null);
    if (newSessions < (kind ? AUTO_RETRAIN_NEW_SESSIONS : MIN_REAL_SESSIONS)) return;

    lastAutoAttempt = Date.now();
    console.log(`[ML] ${newSessions} real sessions not yet learned from — retraining in the background`);
    const result = await retrainFromRealData({ verbose: false });
    if (!result.success) console.error('[ML] Auto-retrain failed:', result.error);
  } catch (err) {
    console.error('[ML] Auto-retrain error:', err.message);
  }
}

// ── CLI entry point ───────────────────────────────
if (require.main === module) {
  retrainFromRealData({
    verbose: true,
    includeSimulated: process.argv.includes('--include-simulated'),
    kind: process.argv.includes('--tree') ? 'tree' : 'logreg',
  })
    .then((result) => {
      if (!result.success) {
        console.error('\n❌ Training failed:', result.error);
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('\n❌ Fatal error:', err.message);
      process.exit(1);
    });
}

module.exports = {
  AUTO_RETRAIN_NEW_SESSIONS,
  TRAINERS,
  trainModel,
  retrainFromRealData,
  maybeAutoRetrain,
  getTrainingReport,
};
