const express = require('express');
const { getBalance, getHistory, getSummary } = require('../controllers/coinController');
const { protect } = require('../middleware/authMiddleware');
const { validatePagination } = require('../middleware/validateRequest');

const router = express.Router();

router.use(protect);

router.get('/balance', getBalance);
router.get('/history', validatePagination, getHistory);
router.get('/summary', getSummary);

module.exports = router;
