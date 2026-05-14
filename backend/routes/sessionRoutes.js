const express = require('express');
const {
  startSession,
  endSession,
  getActiveSession,
  getSessionHistory,
  getSessionStats,
  updateLiveSession,
  getDashboard,
  getLeaderboard,
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
router.post('/live-update', updateLiveSession);
router.get('/active', getActiveSession);
router.get('/history', validatePagination, getSessionHistory);
router.get('/stats', getSessionStats);
router.get('/dashboard', getDashboard);
router.get('/leaderboard', getLeaderboard);

module.exports = router;

