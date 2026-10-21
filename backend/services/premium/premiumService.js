/**
 * Premium purchase: create a Cashfree order, then grant 30 days once Cashfree
 * says it is paid. Premium is only ever granted from Cashfree's own order
 * status (fetched server-side), never from what the browser reports.
 */

const crypto = require('crypto');
const Payment = require('../../models/Payment');
const cashfree = require('./cashfree');
const { PREMIUM_PRICE_INR, extendPremium } = require('./planService');
const { createNotification } = require('../../controllers/notificationController');

const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, '');

/** Where Cashfree posts payment results. Cashfree only accepts https, so none locally. */
const webhookUrl = () => {
  const base = process.env.BACKEND_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return base.startsWith('https://') ? `${base.replace(/\/+$/, '')}/api/premium/webhook` : undefined;
};

/**
 * A mobile number in the form Cashfree wants, or null:
 *   Indian   → 10 digits (accepts +91 / 91 / 0 in front)
 *   abroad   → + country code + number, e.g. +14155550100 (also accepts 00 for +)
 */
function normalisePhone(raw) {
  const s = String(raw || '').replace(/[\s\-().]/g, '').replace(/^00/, '+');
  const indian = s.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  if (indian) return indian[1];
  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}

/** Start a ₹100 order. @returns {Promise<{ orderId, paymentSessionId, mode }>} */
async function startOrder(user, phone) {
  const orderId = `df_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await Payment.create({ userId: user._id, orderId, amount: PREMIUM_PRICE_INR });
  try {
    const order = await cashfree.createOrder({
      orderId,
      amount: PREMIUM_PRICE_INR,
      customerId: String(user._id),
      email: user.email,
      phone,
      returnUrl: `${clientUrl()}/dashboard/premium?order_id={order_id}`,
      notifyUrl: webhookUrl(),
    });
    return { orderId, paymentSessionId: order.payment_session_id, mode: cashfree.mode() };
  } catch (err) {
    await Payment.updateOne({ orderId }, { status: 'failed' });
    throw err;
  }
}

/**
 * Ask Cashfree how an order went and record it. Safe to call any number of
 * times (return page, webhook, retries): Premium is granted once per order.
 * @returns {Promise<Payment|null>}
 */
async function confirmOrder(orderId) {
  const payment = await Payment.findOne({ orderId });
  if (!payment || payment.status === 'paid') return payment;

  const order = await cashfree.getOrder(orderId);
  const paidInFull = order.order_status === 'PAID'
    && Number(order.order_amount) === payment.amount
    && order.order_currency === payment.currency;

  if (!paidInFull) {
    if (['EXPIRED', 'TERMINATED'].includes(order.order_status)) {
      await Payment.updateOne({ orderId, status: 'pending' }, { status: 'failed' });
      return Payment.findOne({ orderId });
    }
    return payment; // still waiting for the user to pay
  }

  const cfPayment = await cashfree.getSuccessfulPayment(orderId).catch(() => null);
  // Only the call that flips the order to paid grants Premium
  const won = await Payment.findOneAndUpdate(
    { orderId, status: { $ne: 'paid' } },
    { status: 'paid', paidAt: new Date(), cfPaymentId: cfPayment?.cf_payment_id ? String(cfPayment.cf_payment_id) : null },
    { new: true }
  );
  if (!won) return Payment.findOne({ orderId });

  const premiumUntil = await extendPremium(won.userId);
  won.premiumUntil = premiumUntil;
  await won.save();

  const day = premiumUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  await createNotification(won.userId, 'system', 'Premium is active', `Thanks for upgrading! You have 50 chats a day until ${day}.`);
  return won;
}

module.exports = { normalisePhone, startOrder, confirmOrder, webhookUrl };
