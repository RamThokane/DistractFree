const mongoose = require('mongoose');

/**
 * The AI weekly report for one user and one local week (Monday to Sunday).
 * Generated once, the first time it's asked for after the week ends; see
 * services/agent/weeklyReportService.js.
 */
const weeklyReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    /** Monday 00:00 of the week, in `timezone`, as an instant. */
    weekStart: {
      type: Date,
      required: true,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    /**
     * generating — one request is writing it (generatingAt says since when)
     * ready      — facts and report are filled in
     */
    status: {
      type: String,
      enum: ['generating', 'ready'],
      default: 'generating',
    },
    generatingAt: {
      type: Date,
      default: Date.now,
    },
    /** The week's numbers, computed in code (never by the model). */
    facts: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    /** { headline, wins[], slips[], goal: { text, suggestedSlot? } } */
    report: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    /** 'gemini' or 'template' (Gemini unavailable or its answer was unusable). */
    source: {
      type: String,
      default: null,
    },
    model: {
      type: String,
      default: null,
    },
    emailedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

weeklyReportSchema.index({ userId: 1, weekStart: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyReport', weeklyReportSchema);
