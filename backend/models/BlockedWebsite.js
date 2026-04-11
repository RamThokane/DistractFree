const mongoose = require('mongoose');

const WEBSITE_CATEGORIES = [
  'social_media',
  'entertainment',
  'news',
  'shopping',
  'gaming',
  'streaming',
  'messaging',
  'other',
];

const blockedWebsiteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    websiteUrl: {
      type: String,
      required: [true, 'Website URL is required'],
      trim: true,
      lowercase: true,
    },
    /**
     * Human-readable label (e.g. "YouTube", "Twitter").
     */
    displayName: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      enum: WEBSITE_CATEGORIES,
      default: 'other',
    },
    /**
     * If false, the site remains in the list but is not actively blocked.
     */
    isActive: {
      type: Boolean,
      default: true,
    },
    /**
     * How many times the user was blocked from visiting this site.
     */
    blockCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: one URL per user
blockedWebsiteSchema.index({ userId: 1, websiteUrl: 1 }, { unique: true });

module.exports = mongoose.model('BlockedWebsite', blockedWebsiteSchema);
module.exports.WEBSITE_CATEGORIES = WEBSITE_CATEGORIES;
