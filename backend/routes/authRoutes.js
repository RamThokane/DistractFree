const express = require('express');
const { register, login, googleAuth, getMe, updateProfile, forgotPassword, resetPassword, deleteAccount } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validateRegister, validateLogin, validateForgotPassword, validateResetPassword } = require('../middleware/validateRequest');

const router = express.Router();

// ── Public routes ──────────────────────────────────

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);

router.post('/google', googleAuth);

router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.post('/reset-password', validateResetPassword, resetPassword);

// ── Protected routes ───────────────────────────────

router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.delete('/account', protect, deleteAccount);

module.exports = router;
