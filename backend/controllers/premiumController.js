/**
 * Premium plan API (Cashfree).
 *
 *   GET  /api/premium/status   — current plan, limits, price, recent payments
 *   POST /api/premium/order    — start a ₹100 order: { phone } → { orderId, paymentSessionId, mode }
 *   POST /api/premium/verify   — after checkout: { orderId } → payment status + plan
 *   POST /api/premium/webhook  — Cashfree's payment notification (signed, no user token)
 */

const Payment = require('../models/Payment');
const User = require('../models/User');
const cashfree = require('../services/premium/cashfree');
const { normalisePhone, startOrder, confirmOrder } = require('../services/premium/premiumService');
const { planFor, FREE_DAILY_CHATS, PREMIUM_DAILY_CHATS, PREMIUM_PRICE_INR, PREMIUM_DAYS } = require('../services/premium/planService');

const paymentView = (p) => ({
  orderId: p.orderId,
  amount: p.amount,
  currency: p.currency,
  status: p.status,
  paidAt: p.paidAt,
  premiumUntil: p.premiumUntil,
  createdAt: p.createdAt,
});

const planView = (user) => {
  const { plan, dailyLimit, premiumUntil } = planFor(user);
  return { plan, dailyLimit, premiumUntil };
};

// ────────────────────────────────────────────────────
// GET /api/premium/status
// ────────────────────────────────────────────────────
exports.getStatus = async (req, res) => {
  try {
    // Only finished payments: abandoned checkouts aren't worth showing
    const payments = await Payment.find({ userId: req.user._id, status: 'paid' }).sort({ createdAt: -1 }).limit(12).lean();
    res.json({
      success: true,
      ...planView(req.user),
      price: PREMIUM_PRICE_INR,
      days: PREMIUM_DAYS,
      freeDailyChats: FREE_DAILY_CHATS,
      premiumDailyChats: PREMIUM_DAILY_CHATS,
      paymentsEnabled: cashfree.isConfigured(),
      payments: payments.map(paymentView),
    });
  } catch (error) {
    console.error('[Premium] Status error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// POST /api/premium/order
// ────────────────────────────────────────────────────
exports.createOrder = async (req, res) => {
  if (!cashfree.isConfigured()) {
    return res.status(503).json({ success: false, message: 'Payments are not set up yet.' });
  }
  if (planFor(req.user).plan === 'owner') {
    return res.status(400).json({ success: false, message: 'Your account already has unlimited access.' });
  }
  const phone = normalisePhone(req.body?.phone);
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Enter a valid mobile number. Outside India, start with + and your country code.' });
  }
  try {
    const order = await startOrder(req.user, phone);
    res.json({ success: true, ...order });
  } catch (error) {
    console.error('[Premium] Create order error:', error.message);
    res.status(502).json({ success: false, message: 'Couldn’t start the payment. Please try again in a moment.' });
  }
};

// ────────────────────────────────────────────────────
// POST /api/premium/verify
// ────────────────────────────────────────────────────
exports.verifyOrder = async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || '');
    const mine = await Payment.exists({ orderId, userId: req.user._id });
    if (!orderId || !mine) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    const payment = await confirmOrder(orderId);
    const user = await User.findById(req.user._id);
    res.json({ success: true, payment: paymentView(payment), ...planView(user) });
  } catch (error) {
    console.error('[Premium] Verify error:', error.message);
    res.status(502).json({ success: false, message: 'Couldn’t check the payment yet. Refresh in a moment.' });
  }
};

// ────────────────────────────────────────────────────
// POST /api/premium/webhook
// Signed by Cashfree; the order is re-checked with Cashfree before anything is granted.
// ────────────────────────────────────────────────────
exports.webhook = async (req, res) => {
  const raw = req.rawBody ? req.rawBody.toString('utf8') : '';
  if (!cashfree.verifyWebhookSignature(raw, req.headers['x-webhook-timestamp'], req.headers['x-webhook-signature'])) {
    return res.status(401).json({ success: false, message: 'Bad signature' });
  }
  const orderId = req.body?.data?.order?.order_id;
  try {
    if (orderId) await confirmOrder(String(orderId));
    res.json({ success: true });
  } catch (error) {
    console.error('[Premium] Webhook error:', error.message);
    // A non-2xx makes Cashfree retry later
    res.status(500).json({ success: false });
  }
};
