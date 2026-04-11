const mongoose = require('mongoose');

const browsingLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    website: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    /**
     * Full URL visited (hostname is derived for matching).
     */
    fullUrl: {
      type: String,
      trim: true,
      default: '',
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    /**
     * Time spent on this page in seconds.
     */
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    /**
     * Whether the visit was to a blocked website.
     */
    wasBlocked: {
      type: Boolean,
      default: false,
    },
    /**
     * Whether the user chose to spend coins to unlock it.
     */
    wasUnlocked: {
      type: Boolean,
      default: false,
    },
    /**
     * The focus session active at the time of this log (if any).
     */
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FocusSession',
      default: null,
    },
    /**
     * Category of the website (populated from BlockedWebsite or heuristic).
     */
    category: {
      type: String,
      default: 'other',
    },
  },
  {
    timestamps: true,
  }
);

browsingLogSchema.index({ userId: 1, timestamp: -1 });
browsingLogSchema.index({ userId: 1, website: 1 });

module.exports = mongoose.model('BrowsingLog', browsingLogSchema);
