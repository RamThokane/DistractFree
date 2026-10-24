/**
 * Cashfree Payment Gateway (PG API 2023-08-01).
 *
 *   CASHFREE_APP_ID, CASHFREE_SECRET_KEY  from the Cashfree dashboard (Developers → API Keys)
 *   CASHFREE_ENV                          'sandbox' (test keys) or 'production'
 */

const crypto = require('crypto');

const API_VERSION = '2023-08-01';

class CashfreeError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.status = status;
  }
}

const mode = () => (process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox');
const baseUrl = () => (mode() === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg');
const isConfigured = () => Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);

// Swappable in tests
let transport = (url, init) => fetch(url, init);
const setTransport = (fn) => { transport = fn; };

async function request(method, path, body) {
  const res = await transport(`${baseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-version': API_VERSION,
      'x-client-id': process.env.CASHFREE_APP_ID,
      'x-client-secret': process.env.CASHFREE_SECRET_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new CashfreeError(data.message || `Cashfree ${res.status}`, { status: res.status });
  return data;
}

/** @returns {Promise<{ payment_session_id: string, order_id: string, order_status: string }>} */
const createOrder = ({ orderId, amount, customerId, email, phone, returnUrl, notifyUrl, note = 'DistractFree Premium (30 days)' }) => request('POST', '/orders', {
  order_id: orderId,
  order_amount: amount,
  order_currency: 'INR',
  customer_details: { customer_id: customerId, customer_email: email, customer_phone: phone },
  order_meta: { return_url: returnUrl, ...(notifyUrl ? { notify_url: notifyUrl } : {}) },
  order_note: note,
});

/** @returns {Promise<{ order_id: string, order_status: 'ACTIVE'|'PAID'|'EXPIRED'|'TERMINATED'|'TERMINATION_REQUESTED', order_amount: number, order_currency: string }>} */
const getOrder = (orderId) => request('GET', `/orders/${encodeURIComponent(orderId)}`);

/** The successful payment of an order, if any. */
async function getSuccessfulPayment(orderId) {
  const payments = await request('GET', `/orders/${encodeURIComponent(orderId)}/payments`);
  return (Array.isArray(payments) ? payments : []).find((p) => p.payment_status === 'SUCCESS') || null;
}

/** Webhook check: base64 HMAC-SHA256 of timestamp + raw body, keyed with the secret key. */
function verifyWebhookSignature(rawBody, timestamp, signature) {
  if (!rawBody || !timestamp || !signature || !process.env.CASHFREE_SECRET_KEY) return false;
  const expected = crypto.createHmac('sha256', process.env.CASHFREE_SECRET_KEY).update(String(timestamp) + rawBody).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  CashfreeError,
  mode,
  isConfigured,
  setTransport,
  createOrder,
  getOrder,
  getSuccessfulPayment,
  verifyWebhookSignature,
};
