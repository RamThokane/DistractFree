const express = require('express');
const rateLimit = require('express-rate-limit');
const { getStatus, createOrder, verifyOrder, webhook } = require('../controllers/premiumController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Cashfree: authorised by its signature, not a user token
router.post('/webhook', webhook);

router.use(protect);

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many payment attempts. Please wait a few minutes.' },
});

router.get('/status', getStatus);
router.post('/order', orderLimiter, createOrder);
router.post('/verify', verifyOrder);

module.exports = router;
