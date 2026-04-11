const express = require('express');
const { logBrowsing } = require('../controllers/insightsController');
const { protect } = require('../middleware/authMiddleware');
const { validateBrowsingLog } = require('../middleware/validateRequest');

const router = express.Router();

router.use(protect);

/**
 * POST /api/browsing/log
 * Log browsing activity from the Chrome extension.
 */
router.post('/log', validateBrowsingLog, logBrowsing);

module.exports = router;
