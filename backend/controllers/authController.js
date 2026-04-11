const User = require('../models/User');
const { generateToken } = require('../middleware/authMiddleware');
const { verifyGoogleToken } = require('../config/googleAuth');
const { validationResult } = require('express-validator');

// ────────────────────────────────────────────────────
// POST /api/auth/register
// ────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        focusCoins: user.focusCoins,
        currentStreak: user.currentStreak,
      },
    });
  } catch (error) {
    console.error('[Auth] Register error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// POST /api/auth/login
// ────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // Include password field for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        focusCoins: user.focusCoins,
        currentStreak: user.currentStreak,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// POST /api/auth/google
// ────────────────────────────────────────────────────
exports.googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required',
      });
    }

    const googleUser = await verifyGoogleToken(credential);

    if (!googleUser.emailVerified) {
      return res.status(401).json({
        success: false,
        message: 'Google email not verified',
      });
    }

    // Find or create user
    let user = await User.findOne({
      $or: [{ googleId: googleUser.googleId }, { email: googleUser.email }],
    });

    if (user) {
      // Link Google ID if user exists by email but doesn't have googleId
      if (!user.googleId) {
        user.googleId = googleUser.googleId;
        user.avatar = user.avatar || googleUser.picture;
        await user.save();
      }
    } else {
      user = await User.create({
        name: googleUser.name,
        email: googleUser.email,
        googleId: googleUser.googleId,
        avatar: googleUser.picture,
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        focusCoins: user.focusCoins,
        currentStreak: user.currentStreak,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('[Auth] Google auth error:', error.message);
    res.status(500).json({ success: false, message: 'Google authentication failed' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/auth/me
// ────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('blockedWebsites');

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        focusCoins: user.focusCoins,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        settings: user.settings,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[Auth] GetMe error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
