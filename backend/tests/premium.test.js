const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Payment = require('../models/Payment');
const cashfree = require('../services/premium/cashfree');
const { planFor, extendPremium, remindIfEndingSoon } = require('../services/premium/planService');
const { normalisePhone, confirmOrder } = require('../services/premium/premiumService');
const premiumController = require('../controllers/premiumController');
const Notification = require('../models/Notification');

const DAY = 24 * 60 * 60 * 1000;
let mongod;

test.before(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.CASHFREE_APP_ID = 'TEST-app';
  process.env.CASHFREE_SECRET_KEY = 'test-secret-key';
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Payment.syncIndexes();
});
test.after(async () => {
  cashfree.setTransport((url, init) => fetch(url, init));
  await mongoose.disconnect();
  await mongod.stop();
});
test.beforeEach(async () => {
  delete process.env.OWNER_EMAILS;
  await Promise.all([User.deleteMany({}), Payment.deleteMany({}), Notification.deleteMany({})]);
});

const makeUser = (extra = {}) => User.create({ name: 'Asha', email: `${new mongoose.Types.ObjectId()}@test.dev`, password: 'password123', ...extra });

const call = (handler, req) => new Promise((resolve) => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(body) { resolve({ status: this.statusCode, body }); } };
  handler(req, res);
});

/** A fake Cashfree: `orders` maps order_id → the order Cashfree would return. */
function fakeCashfree(orders = {}) {
  const calls = [];
  cashfree.setTransport(async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null, headers: init.headers });
    const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
    if (init.method === 'POST' && url.endsWith('/orders')) {
      const b = JSON.parse(init.body);
      orders[b.order_id] = { order_id: b.order_id, order_status: 'ACTIVE', order_amount: b.order_amount, order_currency: 'INR' };
      return json(200, { ...orders[b.order_id], payment_session_id: `session_${b.order_id}` });
    }
    const m = url.match(/\/orders\/([^/]+)(\/payments)?$/);
    if (m && orders[m[1]]) {
      if (m[2]) return json(200, orders[m[1]].order_status === 'PAID' ? [{ cf_payment_id: 555, payment_status: 'SUCCESS' }] : []);
      return json(200, orders[m[1]]);
    }
    return json(404, { message: 'order not found' });
  });
  return { calls, orders };
}

test('plans: free 2, premium 50 while it lasts, owner unlimited', async () => {
  const now = new Date('2026-10-21T10:00:00Z');
  assert.deepEqual(planFor({ email: 'a@x.dev' }, now), { plan: 'free', dailyLimit: 2, premiumUntil: null });
  assert.equal(planFor({ email: 'a@x.dev', premiumUntil: new Date(now.getTime() + DAY) }, now).dailyLimit, 50);
  assert.equal(planFor({ email: 'a@x.dev', premiumUntil: new Date(now.getTime() - 1) }, now).plan, 'free');
  process.env.OWNER_EMAILS = 'Owner@X.dev';
  assert.deepEqual(planFor({ email: 'owner@x.dev' }, now), { plan: 'owner', dailyLimit: null, premiumUntil: null });
});

test('buying again adds 30 days onto the end of the current Premium', async () => {
  const now = new Date('2026-10-21T10:00:00Z');
  const user = await makeUser();
  const first = await extendPremium(user._id, now);
  assert.equal(first.getTime(), now.getTime() + 30 * DAY);
  const second = await extendPremium(user._id, new Date(now.getTime() + 10 * DAY));
  assert.equal(second.getTime(), now.getTime() + 60 * DAY);

  // After it has lapsed, a new purchase starts from today
  const later = new Date(now.getTime() + 100 * DAY);
  assert.equal((await extendPremium(user._id, later)).getTime(), later.getTime() + 30 * DAY);
});

test('mobile numbers: Indian as 10 digits, foreign with + and country code', () => {
  assert.equal(normalisePhone('+91 98765-43210'), '9876543210');
  assert.equal(normalisePhone('919067637964'), '9067637964');
  assert.equal(normalisePhone('09876543210'), '9876543210');
  assert.equal(normalisePhone('+1 (415) 555-0100'), '+14155550100');
  assert.equal(normalisePhone('0044 7911 123456'), '+447911123456');
  assert.equal(normalisePhone('+971501234567'), '+971501234567');
  // Foreign numbers need the +, so they can't be mistaken for Indian ones
  assert.equal(normalisePhone('14155550100'), null);
  assert.equal(normalisePhone('12345'), null);
  assert.equal(normalisePhone('5876543210'), null);
  assert.equal(normalisePhone('+0123456789'), null);
});

test('an order is created for ₹100 with the server price, and the owner cannot buy', async () => {
  const { calls } = fakeCashfree();
  const user = await makeUser();

  const bad = await call(premiumController.createOrder, { user, body: { phone: '123' } });
  assert.equal(bad.status, 400);

  const ok = await call(premiumController.createOrder, { user, body: { phone: '9876543210', amount: 1 } });
  assert.equal(ok.status, 200);
  assert.match(ok.body.paymentSessionId, /^session_df_/);
  assert.equal(ok.body.mode, 'sandbox');
  const sent = calls.find((c) => c.method === 'POST').body;
  assert.equal(sent.order_amount, 100);
  assert.equal(sent.customer_details.customer_phone, '9876543210');
  assert.match(sent.order_meta.return_url, /\/dashboard\/premium\?order_id=\{order_id\}$/);
  assert.equal((await Payment.findOne({ orderId: ok.body.orderId })).status, 'pending');

  process.env.OWNER_EMAILS = user.email;
  assert.equal((await call(premiumController.createOrder, { user, body: { phone: '9876543210' } })).status, 400);
});

test('a paid order grants 30 days exactly once, however many times it is confirmed', async () => {
  const { orders } = fakeCashfree();
  const user = await makeUser();
  const { body } = await call(premiumController.createOrder, { user, body: { phone: '9876543210' } });

  // Not paid yet: nothing granted
  const pending = await call(premiumController.verifyOrder, { user, body: { orderId: body.orderId } });
  assert.equal(pending.body.payment.status, 'pending');
  assert.equal(pending.body.plan, 'free');

  orders[body.orderId].order_status = 'PAID';
  const results = await Promise.all([confirmOrder(body.orderId), confirmOrder(body.orderId), confirmOrder(body.orderId)]);
  assert.ok(results.every((p) => p.status === 'paid'));

  const after = await User.findById(user._id);
  const days = (after.premiumUntil - Date.now()) / DAY;
  assert.ok(days > 29.9 && days <= 30, `about 30 days, got ${days}`);
  const payment = await Payment.findOne({ orderId: body.orderId });
  assert.equal(payment.cfPaymentId, '555');
  assert.equal(payment.premiumUntil.getTime(), after.premiumUntil.getTime());
  assert.equal(await Notification.countDocuments({ userId: user._id, title: 'Premium is active' }), 1);

  const verified = await call(premiumController.verifyOrder, { user, body: { orderId: body.orderId } });
  assert.equal(verified.body.plan, 'premium');
  assert.equal(verified.body.dailyLimit, 50);

  // Someone else can't look up this order
  const other = await makeUser();
  assert.equal((await call(premiumController.verifyOrder, { user: other, body: { orderId: body.orderId } })).status, 404);
});

test('a wrong amount or an expired order grants nothing', async () => {
  const { orders } = fakeCashfree();
  const user = await makeUser();
  const a = (await call(premiumController.createOrder, { user, body: { phone: '9876543210' } })).body.orderId;
  const b = (await call(premiumController.createOrder, { user, body: { phone: '9876543210' } })).body.orderId;

  Object.assign(orders[a], { order_status: 'PAID', order_amount: 1 });
  assert.equal((await confirmOrder(a)).status, 'pending');
  orders[b].order_status = 'EXPIRED';
  assert.equal((await confirmOrder(b)).status, 'failed');
  assert.equal((await User.findById(user._id)).premiumUntil, null);
});

test('the webhook needs a valid Cashfree signature', async () => {
  const { orders } = fakeCashfree();
  const user = await makeUser();
  const { orderId } = (await call(premiumController.createOrder, { user, body: { phone: '9876543210' } })).body;
  orders[orderId].order_status = 'PAID';

  const payload = { type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: orderId } } };
  const raw = JSON.stringify(payload);
  const ts = '1761040000';
  const sign = (secret) => crypto.createHmac('sha256', secret).update(ts + raw).digest('base64');

  const forged = await call(premiumController.webhook, { rawBody: Buffer.from(raw), body: payload, headers: { 'x-webhook-timestamp': ts, 'x-webhook-signature': sign('wrong') } });
  assert.equal(forged.status, 401);
  assert.equal((await User.findById(user._id)).premiumUntil, null);

  const real = await call(premiumController.webhook, { rawBody: Buffer.from(raw), body: payload, headers: { 'x-webhook-timestamp': ts, 'x-webhook-signature': sign('test-secret-key') } });
  assert.equal(real.status, 200);
  assert.ok((await User.findById(user._id)).premiumUntil > new Date());
});

test('a reminder goes out once when Premium ends within 3 days', async () => {
  const now = new Date();
  const user = await makeUser({ premiumUntil: new Date(now.getTime() + 2 * DAY) });
  await remindIfEndingSoon(user, now);
  await remindIfEndingSoon(await User.findById(user._id), now);
  assert.equal(await Notification.countDocuments({ userId: user._id, title: 'Premium ends soon' }), 1);

  const far = await makeUser({ premiumUntil: new Date(now.getTime() + 10 * DAY) });
  await remindIfEndingSoon(far, now);
  assert.equal(await Notification.countDocuments({ userId: far._id }), 0);
});
