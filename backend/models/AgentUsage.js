const mongoose = require('mongoose');

/**
 * How many AI assistant messages a user sent on one local day. Kept in the
 * database (not memory) so the daily cap holds across serverless instances.
 */
const agentUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    /** The user's local day, YYYY-MM-DD. */
    day: {
      type: String,
      required: true,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

agentUsageSchema.index({ userId: 1, day: 1 }, { unique: true });
// Old counters are useless after a day; let MongoDB drop them after a week
agentUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('AgentUsage', agentUsageSchema);
