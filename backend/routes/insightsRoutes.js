const express = require('express');
const {
  getFullInsights,
  predictDistraction,
  getAnalytics,
  logBrowsing,
  downloadWeeklyReport,
  getHeatmap,
  getYearlyHeatmapData,
} = require('../controllers/insightsController');
const { protect } = require('../middleware/authMiddleware');
const { validateBrowsingLog, validatePagination } = require('../middleware/validateRequest');

const router = express.Router();

router.use(protect);

// Full AI Insights endpoint (primary)
router.get('/full', getFullInsights);

// Productivity Heatmap
router.get('/heatmap', getHeatmap);
router.get('/heatmap/yearly', getYearlyHeatmapData);

// Legacy endpoints (backward compat)
router.get('/predict', predictDistraction);
router.get('/analytics', validatePagination, getAnalytics);
router.post('/browsing/log', validateBrowsingLog, logBrowsing);
router.get('/weekly-report', downloadWeeklyReport);

module.exports = router;

