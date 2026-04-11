const express = require('express');
const {
  startSession,
  endSession,
  getActiveSession,
  getSessionHistory,
  getSessionStats,
} = require('../controllers/sessionController');
const { protect } = require('../middleware/authMiddleware');
const {
  validateStartSession,
  validateEndSession,
  validatePagination,
} = require('../middleware/validateRequest');

const router = express.Router();

// All session routes are protected
router.use(protect);

router.post('/start', validateStartSession, startSession);
router.post('/end', validateEndSession, endSession);
router.get('/active', getActiveSession);
router.get('/history', validatePagination, getSessionHistory);
router.get('/stats', getSessionStats);

module.exports = router;
