const express = require('express');
const { retrainFromRealData } = require('../ml/trainModel');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

let retraining = false;

// POST /api/ml/retrain — retrain the decision tree on the latest real session data
router.post('/retrain', async (req, res) => {
  if (retraining) {
    return res.status(409).json({ success: false, message: 'Retraining already in progress' });
  }

  retraining = true;
  try {
    const result = await retrainFromRealData({ verbose: false });
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error, dataset: result.dataset });
    }
    res.json({ success: true, report: result.report, dataset: result.dataset, model: result.modelMeta });
  } catch (error) {
    console.error('[ML] Retrain error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    retraining = false;
  }
});

module.exports = router;
