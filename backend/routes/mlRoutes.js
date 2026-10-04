const express = require('express');
const { retrainFromRealData, getTrainingReport } = require('../ml/trainModel');
const { requestedKind, getModelState, getModelInfo } = require('../ml/activeModel');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

/**
 * Retraining runs Python on the server, so it is an admin action.
 * ML_ADMIN_EMAILS (comma-separated) lists who may trigger it; when unset,
 * any signed-in user may outside production and nobody may in production.
 */
const requireMlAdmin = (req, res, next) => {
  const admins = (process.env.ML_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const allowed = admins.length > 0
    ? admins.includes(req.user.email)
    : process.env.NODE_ENV !== 'production';

  if (!allowed) {
    return res.status(403).json({ success: false, message: 'Not allowed to retrain the model' });
  }
  next();
};

// GET /api/ml/status — which model answers predictions, and how it scored
router.get('/status', (req, res) => {
  const state = getModelState();
  const requested = requestedKind();
  const report = getTrainingReport();
  const trained = report?.status === 'trained';
  res.json({
    success: true,
    requested,
    active: state.kind,
    // ML_MODEL=logreg but only the decision tree could be loaded
    fellBack: state.kind !== null && state.kind !== requested,
    state,
    modelInfo: getModelInfo(),
    metrics: trained
      ? {
        holdout: report.metrics,
        walkForward: report.walk_forward?.model ?? null,
        groupedCv: report.grouped_cv ?? null,
        cv: report.cv,
        modelComparison: report.model_comparison ?? null,
      }
      : null,
    reportStatus: report?.status ?? null,
  });
});

// POST /api/ml/retrain — extract → train → export → hot-reload
// Body: { includeSimulated?: boolean, kind?: 'logreg'|'tree' } (metrics are always on real sessions only)
router.post('/retrain', requireMlAdmin, async (req, res) => {
  if (process.env.VERCEL) {
    return res.status(501).json({
      success: false,
      message: 'Retraining needs Python and is not available on this deployment. Run `npm run ml:retrain` locally and redeploy.',
    });
  }

  try {
    const kind = ['logreg', 'tree'].includes(req.body?.kind) ? req.body.kind : undefined;
    const result = await retrainFromRealData({ verbose: false, includeSimulated: req.body?.includeSimulated === true, kind });
    if (result.busy) {
      return res.status(409).json({ success: false, message: result.error });
    }
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error, dataset: result.dataset });
    }
    res.json({
      success: true,
      trained: result.trained,
      report: result.report,
      dataset: result.dataset,
      model: result.modelMeta || null,
    });
  } catch (error) {
    console.error('[ML] Retrain error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
