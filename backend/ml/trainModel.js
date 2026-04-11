/**
 * DistractFree — Decision Tree Training Orchestrator (Node.js)
 * ==============================================================
 *
 * This module provides a Node.js interface to trigger the Python
 * scikit-learn training pipeline and verify the exported model.
 *
 * Usage:
 *   node ml/trainModel.js            — train from CLI
 *   require('./ml/trainModel')       — use programmatically
 *
 * The Python script (train_model.py) handles the actual training.
 * This wrapper handles process spawning, output streaming, and
 * post-training validation of the exported JSON model.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ML_DIR = __dirname;
const MODEL_DIR = path.join(ML_DIR, 'model');
const MODEL_JSON_PATH = path.join(MODEL_DIR, 'decision_tree_model.json');
const TRAINING_REPORT_PATH = path.join(MODEL_DIR, 'training_report.json');
const PYTHON_SCRIPT = path.join(ML_DIR, 'train_model.py');

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
      const { execSync } = require('child_process');
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
 * Run the Python training pipeline.
 *
 * @param {object} [options]
 * @param {boolean} [options.verbose=true]  — stream Python stdout/stderr
 * @param {number}  [options.timeout=120000] — max training time (ms)
 * @returns {Promise<{ success: boolean, report?: object, error?: string }>}
 */
async function trainModel(options = {}) {
  const { verbose = true, timeout = 120000 } = options;

  console.log('═'.repeat(60));
  console.log('DistractFree — ML Training Orchestrator');
  console.log('═'.repeat(60));

  // ── 1. Check prerequisites ───────────────────────
  console.log('\n[1/4] Checking prerequisites…');

  if (!fs.existsSync(PYTHON_SCRIPT)) {
    throw new Error(`Training script not found: ${PYTHON_SCRIPT}`);
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

  return new Promise((resolve, reject) => {
    const child = spawn(python, [PYTHON_SCRIPT], {
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

      // ── 3. Validate exported model ─────────────────
      console.log('\n[3/4] Validating exported model…');

      if (!fs.existsSync(MODEL_JSON_PATH)) {
        return resolve({
          success: false,
          error: 'Training completed but model JSON was not exported.',
        });
      }

      let modelJson;
      try {
        const raw = fs.readFileSync(MODEL_JSON_PATH, 'utf-8');
        modelJson = JSON.parse(raw);
      } catch (parseErr) {
        return resolve({
          success: false,
          error: `Model JSON is invalid: ${parseErr.message}`,
        });
      }

      // Sanity checks on the tree structure
      const requiredKeys = [
        'children_left', 'children_right', 'feature',
        'threshold', 'value', 'n_nodes', 'class_names',
      ];
      const missingKeys = requiredKeys.filter((k) => !(k in modelJson));

      if (missingKeys.length > 0) {
        return resolve({
          success: false,
          error: `Model JSON missing keys: ${missingKeys.join(', ')}`,
        });
      }

      console.log(`      Model nodes: ${modelJson.n_nodes}`);
      console.log(`      Max depth:   ${modelJson.max_depth}`);
      console.log(`      Classes:     ${modelJson.class_names.join(', ')}`);

      // ── 4. Load training report ────────────────────
      console.log('\n[4/4] Loading training report…');

      let report = null;
      if (fs.existsSync(TRAINING_REPORT_PATH)) {
        try {
          report = JSON.parse(fs.readFileSync(TRAINING_REPORT_PATH, 'utf-8'));
          console.log(`      Accuracy:    ${(report.accuracy * 100).toFixed(1)}%`);
          console.log(`      CV Mean:     ${(report.cv_mean * 100).toFixed(1)}%`);
        } catch {
          console.warn('      Warning: Could not parse training report.');
        }
      }

      console.log('\n✅ Model training and validation complete!\n');

      resolve({
        success: true,
        modelPath: MODEL_JSON_PATH,
        report,
        modelMeta: {
          nodes: modelJson.n_nodes,
          maxDepth: modelJson.max_depth,
          features: modelJson.feature_names,
          classes: modelJson.class_names,
        },
      });
    });
  });
}

/**
 * Check if a trained model is available.
 * @returns {{ available: boolean, meta?: object }}
 */
function getModelStatus() {
  if (!fs.existsSync(MODEL_JSON_PATH)) {
    return { available: false };
  }

  try {
    const raw = fs.readFileSync(MODEL_JSON_PATH, 'utf-8');
    const model = JSON.parse(raw);
    const stat = fs.statSync(MODEL_JSON_PATH);

    const result = {
      available: true,
      meta: {
        nodes: model.n_nodes,
        maxDepth: model.max_depth,
        features: model.feature_names,
        classes: model.class_names,
        trainedAt: stat.mtime.toISOString(),
        fileSizeKB: Math.round(stat.size / 1024),
      },
    };

    // Attach report if available
    if (fs.existsSync(TRAINING_REPORT_PATH)) {
      result.report = JSON.parse(fs.readFileSync(TRAINING_REPORT_PATH, 'utf-8'));
    }

    return result;
  } catch {
    return { available: false };
  }
}

// ── CLI entry point ───────────────────────────────
if (require.main === module) {
  trainModel({ verbose: true })
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

module.exports = { trainModel, getModelStatus };
