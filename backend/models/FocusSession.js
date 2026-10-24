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
    /**
     * Live in-session indicator (low/medium/high), set by a simple rule in
     * utils/liveFocusStatus.js. Not a model output — the field name is legacy.
     */
    mlStatus: {
      type: String,
      default: 'low',
    },
    /**
     * Prediction made when the session started, kept so it can be scored
     * against what actually happened (see actualSuccess).
     */
    predictedSuccessProb: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
    },
    predictedSuccess: {
      type: Boolean,
      default: null,
    },
    /** 'model' = trained model (see ml/activeModel.js), 'baseline' = user's past success rate (model still learning). */
    predictionSource: {
      type: String,
      enum: ['model', 'baseline', null],
      default: null,
    },
    modelVersion: {
      type: String,
      default: null,
    },
    /** Top reasons from the tree's decision path at start, strongest first. */
    predictionReasons: {
      type: [String],
      default: [],
    },
    /** Observed outcome, set when the session ends (ml/target.js). */
    actualSuccess: {
      type: Boolean,
      default: null,
    },
    /** User's IANA timezone at session start; hour-of-day features are local. */
    timezone: {
      type: String,
      default: null,
    },
    /** 'simulated' sessions come from ml/seedSimulatedUsers.js and never count in metrics. */
    source: {
      type: String,
      enum: ['real', 'simulated'],
      default: 'real',
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
    /**
     * Strict-mode grace passes: one free 2-minute visit per blocked site per
     * session. `domain` is the blocklist entry (e.g. "youtube.com").
     */
    gracePasses: [
      {
        _id: false,
        domain: { type: String, required: true },
        startedAt: { type: Date, required: true },
        expiresAt: { type: Date, required: true },
      },
    ],
    /** Strict-mode sites unlocked for the rest of the session with a ₹49 payment. */
    paidUnlocks: [
      {
        _id: false,
        domain: { type: String, required: true },
        orderId: { type: String, required: true },
        paidAt: { type: Date, required: true },
      },
    ],
    notes: {
      type: String,
      maxlength: 500,
      default: '',
    },
    /** The scheduled session this was started from; null when started by hand. */
    scheduledSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduledSession',
      default: null,
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
