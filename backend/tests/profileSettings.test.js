const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const { updateProfile, getMe } = require('../controllers/authController');

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

test('one notification switch is saved on its own and survives a reload', async () => {
  const user = await User.create({ name: 'A', email: 'a@example.com', password: 'secret123' });

  const saved = await call(updateProfile, { user: { _id: user._id }, body: { notifications: { weeklyReportEmail: true } } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.user.settings.notifications.weeklyReportEmail, true);

  // A reload reads the user again: the switch is still on, the others kept their defaults
  const me = await call(getMe, { user: { _id: user._id }, query: {} });
  const n = me.body.user.settings.notifications;
  assert.equal(n.weeklyReportEmail, true);
  assert.equal(n.focusReminder, true);
  assert.equal(n.coinEarned, false);
  assert.ok(me.body.token, 'a renewed token comes back');

  // The weekly email job finds the user
  assert.equal(await User.countDocuments({ 'settings.notifications.weeklyReportEmail': true }), 1);

  // Turning another switch off leaves the email switch alone; junk values are ignored
  await call(updateProfile, { user: { _id: user._id }, body: { notifications: { focusReminder: false, weeklyReportEmail: 'yes', bogus: true } } });
  const after = (await User.findById(user._id).lean()).settings.notifications;
  assert.equal(after.focusReminder, false);
  assert.equal(after.weeklyReportEmail, true);
  assert.equal(after.bogus, undefined);
});
