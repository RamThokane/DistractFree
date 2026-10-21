const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const Notification = require('../models/Notification');
const { deleteAccount, getMe } = require('../controllers/authController');

let mongod;

test.before(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const call = (handler, req) => new Promise((resolve) => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(body) { resolve({ status: this.statusCode, body }); } };
  handler(req, res);
});

test('a wrong password keeps the account; the right one deletes it and its data', async () => {
  const user = await User.create({ name: 'A', email: 'a@example.com', password: 'secret123' });
  const other = await User.create({ name: 'B', email: 'b@example.com', password: 'secret123' });
  await CoinTransaction.create({ userId: user._id, type: 'bonus', amount: 20, balanceAfter: 20, description: 'x' });
  await CoinTransaction.create({ userId: other._id, type: 'bonus', amount: 20, balanceAfter: 20, description: 'x' });

  const me = await call(getMe, { user: { _id: user._id }, query: {} });
  assert.equal(me.body.user.hasPassword, true);

  const wrong = await call(deleteAccount, { user: { _id: user._id }, body: { password: 'nope12345' } });
  assert.equal(wrong.status, 401);
  assert.ok(await User.exists({ _id: user._id }));

  const missing = await call(deleteAccount, { user: { _id: user._id }, body: {} });
  assert.equal(missing.status, 401);

  const ok = await call(deleteAccount, { user: { _id: user._id }, body: { password: 'secret123' } });
  assert.equal(ok.status, 200);
  assert.equal(await User.exists({ _id: user._id }), null);
  assert.equal(await CoinTransaction.countDocuments({ userId: user._id }), 0);

  // Someone else's data is untouched
  assert.ok(await User.exists({ _id: other._id }));
  assert.equal(await CoinTransaction.countDocuments({ userId: other._id }), 1);
});

test('a Google-only account confirms with its email instead of a password', async () => {
  const user = await User.create({ name: 'G', email: 'g@example.com', googleId: 'g-123' });
  await Notification.create({ userId: user._id, type: 'welcome', title: 'Hi', message: 'Hello' });

  const me = await call(getMe, { user: { _id: user._id }, query: {} });
  assert.equal(me.body.user.hasPassword, false);

  const wrong = await call(deleteAccount, { user: { _id: user._id }, body: { confirmEmail: 'other@example.com' } });
  assert.equal(wrong.status, 400);
  assert.ok(await User.exists({ _id: user._id }));

  const ok = await call(deleteAccount, { user: { _id: user._id }, body: { confirmEmail: ' G@Example.com ' } });
  assert.equal(ok.status, 200);
  assert.equal(await User.exists({ _id: user._id }), null);
  assert.equal(await Notification.countDocuments({ userId: user._id }), 0);
});
