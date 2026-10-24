const mongoose = require('mongoose');

/**
 * One purchase attempt through Cashfree: Premium, or a strict-mode site unlock
 * during a focus session (donated to charity). Kept when the account is
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
    purpose: {
      type: String,
      enum: ['premium', 'site_unlock'],
      default: 'premium',
    },
    /** site_unlock: the blocklist entry being unlocked, and the session it is for. */
    domain: { type: String, default: null },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FocusSession',
      default: null,
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
