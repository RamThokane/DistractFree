/**
 * Strict-mode unlocks during a focus session (see services/siteUnlock).
 *
 *   GET  /api/site-unlock/status   — passes and paid unlocks for the running session
 *   POST /api/site-unlock/pass     — use the free 2-minute pass: { domain } → { domain, expiresAt }
 *   POST /api/site-unlock/order    — start a ₹49 unlock: { domain, phone } → { orderId, paymentSessionId, mode }
 *   POST /api/site-unlock/verify   — after checkout: { orderId } → payment status + domain
 *
 * Cashfree's webhook for these orders is the Premium one (/api/premium/webhook).
 */

const Payment = require('../models/Payment');
const cashfree = require('../services/premium/cashfree');
const { normalisePhone, startOrder, confirmOrder } = require('../services/premium/premiumService');
const {
  PASS_MINUTES,
  UNLOCK_PRICE_INR,
  UnlockError,
  strictSessionFor,
  unlockStatus,
  startPass,
  checkUnlockOrder,
} = require('../services/siteUnlock/siteUnlockService');

const fail = (res, error, label) => {
  if (error instanceof UnlockError) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
  console.error(`[SiteUnlock] ${label} error:`, error.message);
  return res.status(500).json({ success: false, message: 'Server error' });
};

// ────────────────────────────────────────────────────
// GET /api/site-unlock/status
// ────────────────────────────────────────────────────
exports.getStatus = async (req, res) => {
  try {
    const session = await strictSessionFor(req.user);
    res.json({
      success: true,
      serverTime: new Date().toISOString(),
      price: UNLOCK_PRICE_INR,
      passMinutes: PASS_MINUTES,
      paymentsEnabled: cashfree.isConfigured(),
      ...unlockStatus(session),
    });
  } catch (error) {
    fail(res, error, 'Status');
  }
};

// ────────────────────────────────────────────────────
// POST /api/site-unlock/pass
// ────────────────────────────────────────────────────
exports.startPass = async (req, res) => {
  try {
    const { domain, expiresAt } = await startPass(req.user, req.body?.domain);
    res.json({ success: true, serverTime: new Date().toISOString(), domain, expiresAt });
  } catch (error) {
    fail(res, error, 'Pass');
  }
};

// ────────────────────────────────────────────────────
// POST /api/site-unlock/order
// ────────────────────────────────────────────────────
exports.createOrder = async (req, res) => {
  if (!cashfree.isConfigured()) {
    return res.status(503).json({ success: false, message: 'Payments are not set up yet.' });
  }
  const phone = normalisePhone(req.body?.phone);
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Enter a valid mobile number. Outside India, start with + and your country code.' });
  }
  try {
    const { domain, session } = await checkUnlockOrder(req.user, req.body?.domain);

    // An earlier checkout for this site may have been paid already: never charge twice
    const earlier = await Payment.find({ userId: req.user._id, purpose: 'site_unlock', sessionId: session._id, domain, status: 'pending' }).select('orderId').lean();
    for (const p of earlier) {
      const done = await confirmOrder(p.orderId).catch(() => null);
      if (done?.status === 'paid') {
        return res.status(409).json({ success: false, code: 'ALREADY_UNLOCKED', message: `${domain} is already unlocked for this session.` });
      }
    }

    const order = await startOrder(req.user, phone, { purpose: 'site_unlock', amount: UNLOCK_PRICE_INR, domain, sessionId: session._id });
    res.json({ success: true, domain, ...order });
  } catch (error) {
    if (error instanceof UnlockError) return fail(res, error, 'Order');
    console.error('[SiteUnlock] Create order error:', error.message);
    res.status(502).json({ success: false, message: 'Couldn’t start the payment. Please try again in a moment.' });
  }
};

// ────────────────────────────────────────────────────
// POST /api/site-unlock/verify
// ────────────────────────────────────────────────────
exports.verifyOrder = async (req, res) => {
  try {
    const orderId = String(req.body?.orderId || '');
    const mine = await Payment.exists({ orderId, userId: req.user._id, purpose: 'site_unlock' });
    if (!orderId || !mine) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    const payment = await confirmOrder(orderId);
    res.json({
      success: true,
      payment: { orderId: payment.orderId, status: payment.status, amount: payment.amount, domain: payment.domain, paidAt: payment.paidAt },
    });
  } catch (error) {
    console.error('[SiteUnlock] Verify error:', error.message);
    res.status(502).json({ success: false, message: 'Couldn’t check the payment yet. Refresh in a moment.' });
  }
};
