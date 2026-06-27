const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const { generateToken } = require('../middleware/authMiddleware');
const { verifyGoogleToken } = require('../config/googleAuth');
const { validationResult } = require('express-validator');
const { createNotification } = require('./notificationController');

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

    // Welcome bonus: 20 starter coins (already set as default in schema)
    await CoinTransaction.create({
      userId: user._id,
      type: 'bonus',
      amount: 20,
      balanceAfter: 20,
      description: 'Welcome bonus — 20 starter Focus Coins!',
    });

    // Welcome notification
    await createNotification(
      user._id,
      'welcome',
      '🎉 Welcome to DistractFree!',
      'You have received 20 starter Focus Coins. Start a focus session to earn more!'
    );

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

    // emailVerified might be undefined in some cases, so explicitly check for false
    if (googleUser.emailVerified === false) {
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
      // Fallback name if missing from Google profile
      const name = googleUser.name || googleUser.email.split('@')[0];
      
      user = await User.create({
        name: name.length > 60 ? name.substring(0, 60) : name,
        email: googleUser.email,
        googleId: googleUser.googleId,
        avatar: googleUser.picture || '',
      });

      // Welcome bonus for new Google users
      await CoinTransaction.create({
        userId: user._id,
        type: 'bonus',
        amount: 20,
        balanceAfter: 20,
        description: 'Welcome bonus — 20 starter Focus Coins!',
      });

      await createNotification(
        user._id,
        'welcome',
        '🎉 Welcome to DistractFree!',
        'You have received 20 starter Focus Coins. Start a focus session to earn more!'
      );
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
    const user = await User.findById(req.user._id);

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
        dailyGoal: user.dailyGoal,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[Auth] GetMe error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// PUT /api/auth/profile
// ────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const { name, theme, strictMode, notifications, dailyGoal } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name;
    
    if (theme) user.settings.theme = theme;
    if (strictMode !== undefined) user.settings.strictMode = strictMode;
    if (notifications) {
      user.settings.notifications = {
        ...user.settings.notifications,
        ...notifications
      };
    }

    // Daily goal update
    if (dailyGoal) {
      if (dailyGoal.focusMinutes !== undefined) user.dailyGoal.focusMinutes = dailyGoal.focusMinutes;
      if (dailyGoal.sessions !== undefined) user.dailyGoal.sessions = dailyGoal.sessions;
      user.dailyGoal.lastSetDate = new Date();
    }

    await user.save();

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
        dailyGoal: user.dailyGoal,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[Auth] UpdateProfile error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
