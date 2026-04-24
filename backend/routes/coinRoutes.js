const express = require('express');
const { getBalance, getHistory, getSummary } = require('../controllers/coinController');
const { unlockWebsite } = require('../controllers/websiteController');
const { protect } = require('../middleware/authMiddleware');
const { validatePagination, validateUnlockWebsite } = require('../middleware/validateRequest');

const router = express.Router();

router.use(protect);

router.get('/balance', getBalance);
router.get('/history', validatePagination, getHistory);
router.get('/summary', getSummary);
router.post('/unlock', validateUnlockWebsite, unlockWebsite);

module.exports = router;
