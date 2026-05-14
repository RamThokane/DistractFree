const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never return password by default
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    focusCoins: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastSessionDate: {
      type: Date,
      default: null,
    },
    blockedWebsites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BlockedWebsite',
      },
    ],
    dailyGoal: {
      focusMinutes: { type: Number, default: 0 },
      sessions: { type: Number, default: 0 },
      lastSetDate: { type: Date, default: null },
    },
    settings: {
      dailyGoalMinutes: { type: Number, default: 120 },
      theme: { type: String, enum: ['light', 'dark', 'minimal', 'system'], default: 'light' },
      strictMode: { type: Boolean, default: false },
      notifications: {
        focusReminder: { type: Boolean, default: true },
        streakAlert: { type: Boolean, default: true },
        weeklyReport: { type: Boolean, default: true },
        coinEarned: { type: Boolean, default: false },
      }
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ────────────────────────────────────────
// email and googleId indexes are created automatically by `unique: true` in the schema.
// Additional compound indexes can be added here if needed.

// ── Pre-save: hash password ────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Instance methods ───────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Update the user's streak based on session completion date.
 * Call this whenever a focus session ends successfully.
 */
userSchema.methods.updateStreak = function () {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (this.lastSessionDate) {
    const lastDate = new Date(this.lastSessionDate);
    const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
    const diffDays = Math.round((today - lastDay) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      this.currentStreak += 1;
    } else if (diffDays > 1) {
      this.currentStreak = 1;
    }
    // diffDays === 0 → same day, streak unchanged
  } else {
    this.currentStreak = 1;
  }

  if (this.currentStreak > this.longestStreak) {
    this.longestStreak = this.currentStreak;
  }

  this.lastSessionDate = now;
};

module.exports = mongoose.model('User', userSchema);
