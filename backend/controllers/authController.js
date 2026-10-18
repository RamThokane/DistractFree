const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const { generateToken } = require('../middleware/authMiddleware');
const { verifyGoogleToken } = require('../config/googleAuth');
const { validationResult } = require('express-validator');
const { createNotification } = require('./notificationController');
const { syncUserStreak } = require('../services/streakService');
const crypto = require('crypto');
const { sendEmail, isConfigured: emailConfigured } = require('../utils/mailer');

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
    await syncUserStreak(user, req.query.tz);

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

// ────────────────────────────────────────────────────
// Password reset
// ────────────────────────────────────────────────────
const RESET_TTL_MS = 30 * 60 * 1000;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, '');

// POST /api/auth/forgot-password — always the same answer, so it can't be used
// to find out which emails have accounts.
exports.forgotPassword = async (req, res) => {
  const reply = () => res.json({
    success: true,
    message: 'If an account exists for that email, a reset link is on its way.',
  });
  try {
    // Be honest when email can't go out (same answer for every address)
    if (!emailConfigured() && process.env.NODE_ENV === 'production') {
      console.error('[Auth] Password reset requested but RESEND_API_KEY is not set');
      return res.status(503).json({
        success: false,
        message: 'Password reset by email isn’t set up yet. Contact support to reset your password.',
      });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return reply();

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = hashToken(token);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TTL_MS);
    await user.save({ validateBeforeSave: false });

    const link = `${clientUrl()}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    const name = (user.name || '').split(' ')[0] || 'there';
    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset your DistractFree password',
        text: `Hi ${name},\n\nSomeone (hopefully you) asked to reset the password for your DistractFree account.\n\nChoose a new password here (the link works for 30 minutes, once):\n${link}\n\nIf you didn't ask for this, ignore this email — your password stays the same.\n\n— DistractFree`,
        html: `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1C1B19;background:#FAF8F5">
  <p style="font-size:15px;margin:0 0 16px">Hi ${name},</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 24px">Someone (hopefully you) asked to reset the password for your DistractFree account.</p>
  <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#1F5E4A;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px">Choose a new password</a></p>
  <p style="font-size:13px;line-height:1.6;color:#6B645A;margin:0 0 8px">The link works once, for 30 minutes. If you didn't ask for this, ignore this email — your password stays the same.</p>
  <p style="font-size:13px;color:#6B645A;margin:24px 0 0">— DistractFree</p>
</div>`,
      });
    } catch (mailErr) {
      // Don't tell the visitor; the server log has the reason
      console.error('[Auth] Reset email failed:', mailErr.message);
    }
    return reply();
  } catch (error) {
    console.error('[Auth] Forgot password error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/auth/reset-password — { email, token, password }
exports.resetPassword = async (req, res) => {
  try {
    const { email, token, password } = req.body;
    const user = await User.findOne({ email }).select('+resetPasswordToken +resetPasswordExpires');

    const valid = user
      && user.resetPasswordToken
      && user.resetPasswordExpires
      && user.resetPasswordExpires.getTime() > Date.now()
      && crypto.timingSafeEqual(Buffer.from(user.resetPasswordToken), Buffer.from(hashToken(token)));
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'This reset link is invalid or has expired. Ask for a new one.',
      });
    }

    user.password = password; // hashed by the pre-save hook
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password updated. You can sign in now.' });
  } catch (error) {
    console.error('[Auth] Reset password error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
