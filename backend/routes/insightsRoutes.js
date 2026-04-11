const express = require('express');
const { predictDistraction, getAnalytics, logBrowsing } = require('../controllers/insightsController');
const { protect } = require('../middleware/authMiddleware');
const { validateBrowsingLog, validatePagination } = require('../middleware/validateRequest');

const router = express.Router();

router.use(protect);

router.get('/predict', predictDistraction);
router.get('/analytics', validatePagination, getAnalytics);
router.post('/browsing/log', validateBrowsingLog, logBrowsing);

module.exports = router;
