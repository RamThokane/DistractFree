const express = require('express');
const { register, login, googleAuth, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validateRegister, validateLogin } = require('../middleware/validateRequest');

const router = express.Router();

// ── Public routes ──────────────────────────────────

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);

router.post('/google', googleAuth);

// ── Protected routes ───────────────────────────────

router.get('/me', protect, getMe);

module.exports = router;
