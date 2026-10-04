const mongoose = require('mongoose');

/**
 * A focus session planned ahead of time. It starts automatically when it is
 * due (see services/scheduleService.js).
 *
 * Three kinds of document share this schema:
 *   - single:     repeat 'none', no seriesId — one occurrence at startAt
 *   - series:     repeat 'daily' | 'weekly' — a template; its occurrences are
 *                 computed on the fly at the local time of startAt, from
 *                 startAt onwards (weekly: on repeatDays)
 *   - occurrence: repeat 'none' with seriesId + occurrenceStart — one
 *                 occurrence of a series that has its own state (started,
 *                 missed, cancelled, edited, or reminded). It replaces the
 *                 computed occurrence with the same occurrenceStart.
 */
const scheduledSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 60,
      default: '',
    },
    /** Start of the occurrence (single/occurrence) or of the first occurrence (series). */
    startAt: {
      type: Date,
      required: true,
    },
    /** Minutes. */
    plannedDuration: {
      type: Number,
      required: true,
      min: 5,
      max: 240,
    },
    repeat: {
      type: String,
      enum: ['none', 'daily', 'weekly'],
      default: 'none',
    },
    /** Series only: no occurrences at or after this instant (set when the rest is edited or cancelled). */
    repeatUntil: {
      type: Date,
      default: null,
    },
    /** Local weekdays (0 = Sunday … 6 = Saturday) a weekly series runs on. */
    repeatDays: {
      type: [{ type: Number, min: 0, max: 6 }],
      default: [],
    },
    /**
     * scheduled — waiting to start (a series stays 'scheduled' while active)
     * started   — a FocusSession was created from it (focusSessionId)
     * missed    — not started within the start window, or another session was running
     * cancelled — removed by the user
     */
    status: {
      type: String,
      enum: ['scheduled', 'started', 'missed', 'cancelled'],
      default: 'scheduled',
    },
    focusSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FocusSession',
      default: null,
    },
    /** The 10-minute reminder was sent (single/occurrence only). */
    reminderSent: {
      type: Boolean,
      default: false,
    },
    /** IANA timezone the local start time is defined in. */
    timezone: {
      type: String,
      default: 'UTC',
    },
    /** Occurrence documents only: the series and the computed start they replace. */
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduledSession',
      default: null,
    },
    occurrenceStart: {
      type: Date,
      default: null,
    },
    /** Occurrence documents only: the user changed this occurrence on its own. */
    edited: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

scheduledSessionSchema.index({ userId: 1, startAt: 1 });
// One occurrence document per computed occurrence; also makes claiming one atomic
scheduledSessionSchema.index(
  { seriesId: 1, occurrenceStart: 1 },
  { unique: true, partialFilterExpression: { seriesId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('ScheduledSession', scheduledSessionSchema);
