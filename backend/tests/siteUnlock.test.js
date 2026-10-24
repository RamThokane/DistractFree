const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Payment = require('../models/Payment');
const FocusSession = require('../models/FocusSession');
const BlockedWebsite = require('../models/BlockedWebsite');
const Notification = require('../models/Notification');
const cashfree = require('../services/premium/cashfree');
const mailer = require('../utils/mailer');
const { startPass, checkUnlockOrder, PASS_MS } = require('../services/siteUnlock/siteUnlockService');
const siteUnlockController = require('../controllers/siteUnlockController');
const premiumController = require('../controllers/premiumController');
const authController = require('../controllers/authController');
const websiteController = require('../controllers/websiteController');

let mongod;
const originalSend = mailer.sendEmail;

test.before(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.CASHFREE_APP_ID = 'TEST-app';
  process.env.CASHFREE_SECRET_KEY = 'test-secret-key';
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Payment.syncIndexes();
  mailer.sendEmail = async () => ({ delivered: true });
});
test.after(async () => {
  mailer.sendEmail = originalSend;
  cashfree.setTransport((url, init) => fetch(url, init));
  await mongoose.disconnect();
  await mongod.stop();
});
test.beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Payment.deleteMany({}), FocusSession.deleteMany({}),
    BlockedWebsite.deleteMany({}), Notification.deleteMany({}),
  ]);
});

/** A strict-mode user with youtube.com blocked and (unless session: false) a running session. */
async function setup({ strict = true, session = true } = {}) {
  const user = await User.create({
    name: 'Asha', email: `${new mongoose.Types.ObjectId()}@test.dev`, password: 'password123',
    settings: { strictMode: strict },
  });
  const site = await BlockedWebsite.create({ userId: user._id, websiteUrl: 'youtube.com' });
  const focus = session ? await FocusSession.create({ userId: user._id, plannedDuration: 50 }) : null;
  return { user, site, focus };
}

const call = (handler, req) => new Promise((resolve) => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(body) { resolve({ status: this.statusCode, body }); } };
  handler(req, res);
});

/** A fake Cashfree: `orders` maps order_id → the order Cashfree would return. */
function fakeCashfree(orders = {}) {
  const calls = [];
  cashfree.setTransport(async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null });
    const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
    if (init.method === 'POST' && url.endsWith('/orders')) {
      const b = JSON.parse(init.body);
      orders[b.order_id] = { order_id: b.order_id, order_status: 'ACTIVE', order_amount: b.order_amount, order_currency: 'INR' };
      return json(200, { ...orders[b.order_id], payment_session_id: `session_${b.order_id}` });
    }
    const m = url.match(/\/orders\/([^/]+)(\/payments)?$/);
    if (m && orders[m[1]]) {
      if (m[2]) return json(200, orders[m[1]].order_status === 'PAID' ? [{ cf_payment_id: 777, payment_status: 'SUCCESS' }] : []);
      return json(200, orders[m[1]]);
    }
    return json(404, { message: 'order not found' });
  });
  return { calls, orders };
}

/** Use up the free pass, then move past its 2 minutes. */
async function usePass(user, focus) {
  await startPass(user, 'youtube.com');
  await FocusSession.updateOne({ _id: focus._id }, { $set: { 'gracePasses.0.expiresAt': new Date(Date.now() - 1000) } });
}

test('one free 2-minute pass per site per session, shared by its subdomains', async () => {
  const { user, focus } = await setup();
  const now = new Date();
  const pass = await startPass(user, 'm.youtube.com', now);
  assert.equal(pass.domain, 'youtube.com');
  assert.equal(pass.expiresAt.getTime(), now.getTime() + PASS_MS);

  await assert.rejects(startPass(user, 'youtube.com'), { code: 'PASS_USED' });
  await assert.rejects(startPass(user, 'www.youtube.com'), { code: 'PASS_USED' });
  assert.equal((await FocusSession.findById(focus._id)).gracePasses.length, 1);

  // Two tabs at once still get one pass
  const fresh = await setup();
  const results = await Promise.allSettled([startPass(fresh.user, 'youtube.com'), startPass(fresh.user, 'youtube.com')]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
});

test('a new session starts with a fresh pass', async () => {
  const { user, focus } = await setup();
  await startPass(user, 'youtube.com');
  await FocusSession.updateOne({ _id: focus._id }, { status: 'completed', endTime: new Date() });
  await FocusSession.create({ userId: user._id, plannedDuration: 25 });
  const pass = await startPass(user, 'youtube.com');
  assert.equal(pass.domain, 'youtube.com');
});

test('nothing changes outside a strict-mode focus session', async () => {
  const notStrict = await setup({ strict: false });
  await assert.rejects(startPass(notStrict.user, 'youtube.com'), { code: 'NOT_STRICT' });

  const noSession = await setup({ session: false });
  await assert.rejects(startPass(noSession.user, 'youtube.com'), { code: 'NO_SESSION' });
  const status = await call(siteUnlockController.getStatus, { user: noSession.user });
  assert.equal(status.body.focusStrict, false);

  // Sites not on the (active) block list get no pass
  const { user, site } = await setup();
  await assert.rejects(startPass(user, 'reddit.com'), { code: 'NOT_BLOCKED' });
  await BlockedWebsite.updateOne({ _id: site._id }, { isActive: false });
  await assert.rejects(startPass(user, 'youtube.com'), { code: 'NOT_BLOCKED' });
});

test('the ₹49 unlock is only offered once the free pass is used up', async () => {
  const { user, focus } = await setup();
  await assert.rejects(checkUnlockOrder(user, 'youtube.com'), { code: 'PASS_AVAILABLE' });
  await startPass(user, 'youtube.com');
  await assert.rejects(checkUnlockOrder(user, 'youtube.com'), { code: 'PASS_RUNNING' });
  await FocusSession.updateOne({ _id: focus._id }, { $set: { 'gracePasses.0.expiresAt': new Date(Date.now() - 1000) } });
  const ok = await checkUnlockOrder(user, 'youtube.com');
  assert.equal(ok.domain, 'youtube.com');
});

test('a paid ₹49 order unlocks the site for the session, exactly once', async () => {
  const { user, focus } = await setup();
  await usePass(user, focus);
  const { calls, orders } = fakeCashfree();

  const res = await call(siteUnlockController.createOrder, { user, body: { domain: 'youtube.com', phone: '9876543210' } });
  assert.equal(res.status, 200);
  const created = calls.find((c) => c.method === 'POST');
  assert.equal(created.body.order_amount, 49);
  assert.match(created.body.order_meta.return_url, /\/dashboard\/unlock\?order_id=/);
  assert.match(created.body.order_note, /charity/);

  // Not paid yet → still blocked
  let verify = await call(siteUnlockController.verifyOrder, { user, body: { orderId: res.body.orderId } });
  assert.equal(verify.body.payment.status, 'pending');
  assert.equal((await FocusSession.findById(focus._id)).paidUnlocks.length, 0);

  orders[res.body.orderId].order_status = 'PAID';
  verify = await call(siteUnlockController.verifyOrder, { user, body: { orderId: res.body.orderId } });
  assert.equal(verify.body.payment.status, 'paid');
  assert.equal(verify.body.payment.domain, 'youtube.com');

  // A duplicate webhook is a no-op
  const payload = { data: { order: { order_id: res.body.orderId } } };
  const raw = JSON.stringify(payload);
  const ts = String(Date.now());
  const signature = crypto.createHmac('sha256', 'test-secret-key').update(ts + raw).digest('base64');
  const hook = await call(premiumController.webhook, { rawBody: Buffer.from(raw), body: payload, headers: { 'x-webhook-timestamp': ts, 'x-webhook-signature': signature } });
  assert.equal(hook.status, 200);

  const after = await FocusSession.findById(focus._id);
  assert.deepEqual(after.paidUnlocks.map((u) => u.domain), ['youtube.com']);
  assert.equal(await Notification.countDocuments({ userId: user._id, title: 'youtube.com unlocked' }), 1);
  // Premium is untouched
  assert.equal((await User.findById(user._id)).premiumUntil, null);

  const again = await call(siteUnlockController.createOrder, { user, body: { domain: 'youtube.com', phone: '9876543210' } });
  assert.equal(again.body.code, 'ALREADY_UNLOCKED');
  const status = await call(siteUnlockController.getStatus, { user });
  assert.deepEqual(status.body.paidDomains, ['youtube.com']);
});

test('an earlier checkout that was paid stops a second charge', async () => {
  const { user, focus } = await setup();
  await usePass(user, focus);
  const { orders } = fakeCashfree();
  const first = await call(siteUnlockController.createOrder, { user, body: { domain: 'youtube.com', phone: '9876543210' } });
  orders[first.body.orderId].order_status = 'PAID'; // paid, but the user never came back
  const second = await call(siteUnlockController.createOrder, { user, body: { domain: 'youtube.com', phone: '9876543210' } });
  assert.equal(second.status, 409);
  assert.equal(await Payment.countDocuments({ purpose: 'site_unlock' }), 1);
});

test('a failed or cancelled payment keeps the site blocked', async () => {
  const { user, focus } = await setup();
  await usePass(user, focus);
  const { orders } = fakeCashfree();
  const res = await call(siteUnlockController.createOrder, { user, body: { domain: 'youtube.com', phone: '9876543210' } });
  orders[res.body.orderId].order_status = 'EXPIRED';
  const verify = await call(siteUnlockController.verifyOrder, { user, body: { orderId: res.body.orderId } });
  assert.equal(verify.body.payment.status, 'failed');
  assert.equal((await FocusSession.findById(focus._id)).paidUnlocks.length, 0);
});

test('no unlock orders outside a strict-mode session', async () => {
  const { user } = await setup({ session: false });
  fakeCashfree();
  const res = await call(siteUnlockController.createOrder, { user, body: { domain: 'youtube.com', phone: '9876543210' } });
  assert.equal(res.status, 409);
  assert.equal(await Payment.countDocuments({}), 0);
});

test('strict mode and the block list are locked during a strict-mode session', async () => {
  const { user, site, focus } = await setup();

  const off = await call(authController.updateProfile, { user, body: { strictMode: false } });
  assert.equal(off.status, 409);
  assert.equal((await User.findById(user._id)).settings.strictMode, true);

  const pause = await call(websiteController.toggleWebsite, { user, params: { id: String(site._id) } });
  assert.equal(pause.status, 409);
  const remove = await call(websiteController.removeWebsite, { user, body: { websiteId: String(site._id) } });
  assert.equal(remove.status, 409);
  assert.equal(await BlockedWebsite.countDocuments({ _id: site._id, isActive: true }), 1);

  // After the session, both work again
  await FocusSession.updateOne({ _id: focus._id }, { status: 'completed', endTime: new Date() });
  const offLater = await call(authController.updateProfile, { user, body: { strictMode: false } });
  assert.equal(offLater.status, 200);
  assert.equal((await User.findById(user._id)).settings.strictMode, false);
});
