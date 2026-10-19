const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const { getStatus, chat } = require('../controllers/agentController');
const { protect } = require('../middleware/authMiddleware');
const { handleValidationErrors } = require('../middleware/validateRequest');

const router = express.Router();

router.use(protect);

// Per user, on top of the daily cap (AGENT_DAILY_LIMIT, stored in the database)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Slow down a little: at most 10 messages a minute.' },
});

const validateChat = [
  body('messages').isArray({ min: 1, max: 40 }).withMessage('messages must be a list of 1-40 messages'),
  body('timezone').optional().isString().isLength({ max: 64 }),
  handleValidationErrors,
];

router.get('/status', getStatus);
router.post('/chat', chatLimiter, validateChat, chat);

module.exports = router;
