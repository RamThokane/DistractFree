const mongoose = require('mongoose');

const TRANSACTION_TYPES = ['earned', 'spent', 'bonus', 'penalty'];

const coinTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: TRANSACTION_TYPES,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    /**
     * Running balance after this transaction.
     */
    balanceAfter: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      maxlength: 200,
      default: '',
    },
    /**
     * Optional reference to the session that triggered this transaction.
     */
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FocusSession',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

coinTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);
module.exports.TRANSACTION_TYPES = TRANSACTION_TYPES;
