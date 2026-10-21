const mongoose = require('mongoose');

/**
 * One Premium purchase attempt through Cashfree. Kept when the account is
 * deleted (it holds no personal details) for accounting and disputes.
 */
const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** Our order id, also the Cashfree order_id. */
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    /** Cashfree's id for the successful payment. */
    cfPaymentId: { type: String, default: null },
    paidAt: { type: Date, default: null },
    /** Premium end date this payment produced. */
    premiumUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
