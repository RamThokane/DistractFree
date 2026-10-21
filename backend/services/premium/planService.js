/**
 * Plans and how many assistant chats each one gets per day.
 *
 *   free     2 chats a day
 *   premium  50 chats a day, ₹100 once for 30 days
 *   owner    unlimited (emails in OWNER_EMAILS, comma-separated)
 */

const User = require('../../models/User');
const { createNotification } = require('../../controllers/notificationController');

const FREE_DAILY_CHATS = 2;
const PREMIUM_DAILY_CHATS = 50;
const PREMIUM_PRICE_INR = 100;
const PREMIUM_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const REMIND_BEFORE_MS = 3 * DAY_MS;

const ownerEmails = () => (process.env.OWNER_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const isOwner = (user) => Boolean(user?.email) && ownerEmails().includes(String(user.email).toLowerCase());

const isPremium = (user, now = new Date()) => Boolean(user?.premiumUntil) && new Date(user.premiumUntil) > now;

/**
 * @returns {{ plan: 'owner'|'premium'|'free', dailyLimit: number|null, premiumUntil: Date|null }}
 *   dailyLimit is null when there is no limit
 */
function planFor(user, now = new Date()) {
  if (isOwner(user)) return { plan: 'owner', dailyLimit: null, premiumUntil: null };
  if (isPremium(user, now)) return { plan: 'premium', dailyLimit: PREMIUM_DAILY_CHATS, premiumUntil: user.premiumUntil };
  return { plan: 'free', dailyLimit: FREE_DAILY_CHATS, premiumUntil: user?.premiumUntil || null };
}

/**
 * Add PREMIUM_DAYS to the user's Premium, starting from today or from when the
 * current Premium ends, whichever is later. Atomic, so two payments can't overlap.
 * @returns {Promise<Date>} the new end date
 */
async function extendPremium(userId, now = new Date()) {
  const user = await User.findOneAndUpdate(
    { _id: userId },
    [{ $set: { premiumUntil: { $add: [{ $max: [{ $ifNull: ['$premiumUntil', now] }, now] }, PREMIUM_DAYS * DAY_MS] } } }],
    { new: true }
  ).select('premiumUntil');
  return user?.premiumUntil || null;
}

/** Once per Premium period, a notification when it ends within 3 days. */
async function remindIfEndingSoon(user, now = new Date()) {
  if (!isPremium(user, now) || isOwner(user)) return;
  const until = new Date(user.premiumUntil);
  if (until - now > REMIND_BEFORE_MS) return;
  if (user.premiumReminderFor && new Date(user.premiumReminderFor).getTime() === until.getTime()) return;

  const claimed = await User.updateOne(
    { _id: user._id, premiumReminderFor: { $ne: until } },
    { $set: { premiumReminderFor: until } }
  );
  if (!claimed.modifiedCount) return;
  const day = until.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  await createNotification(
    user._id,
    'system',
    'Premium ends soon',
    `Your Premium ends on ${day}. Extend it for ₹${PREMIUM_PRICE_INR} to keep ${PREMIUM_DAILY_CHATS} chats a day.`
  );
}

module.exports = {
  FREE_DAILY_CHATS,
  PREMIUM_DAILY_CHATS,
  PREMIUM_PRICE_INR,
  PREMIUM_DAYS,
  isOwner,
  isPremium,
  planFor,
  extendPremium,
  remindIfEndingSoon,
};
