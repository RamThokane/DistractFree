const mongoose = require('mongoose');

const focusSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    /**
     * Planned duration in minutes (set at start).
     */
    plannedDuration: {
      type: Number,
      required: true,
      min: 1,
    },
    /**
     * Actual duration in minutes (computed at end).
     */
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },
    coinsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
    mlStatus: {
      type: String,
      default: 'Focused',
    },
    tabSwitches: {
      type: Number,
      default: 0,
      min: 0,
    },
    interruptions: {
      type: Number,
      default: 0,
      min: 0,
    },
    /**
     * Number of times the user attempted to visit a blocked site.
     */
    distractionAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    /**
     * Snapshot of the blocked sites active during this session.
     */
    blockedSitesUsed: [
      {
        type: String,
        trim: true,
      },
    ],
    /**
     * Coins spent unlocking blocked sites during this session.
     */
    coinsSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      maxlength: 500,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ────────────────────────────────────────
focusSessionSchema.index({ userId: 1, startTime: -1 });
focusSessionSchema.index({ status: 1 });

// ── Virtuals ───────────────────────────────────────
focusSessionSchema.virtual('isActive').get(function () {
  return this.status === 'active';
});

module.exports = mongoose.model('FocusSession', focusSessionSchema);
