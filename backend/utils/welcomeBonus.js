/**
 * Welcome bonus — every account starts with the User model's default
 * focusCoins (20). That used to be silent: no CoinTransaction, so the Coins
 * page never showed where the first coins came from.
 *
 * Signup records it; accounts created before that never got the entry.
 * ensureWelcomeBonus() adds it once, dated to signup, without touching the
 * balance (the coins are already in it). Called from the coin endpoints.
 */

const CoinTransaction = require('../models/CoinTransaction');
const User = require('../models/User');

const WELCOME_BONUS = Number(User.schema.path('focusCoins').defaultValue) || 20;
// Signup has written 'Welcome bonus — 20 starter Focus Coins!' for a while;
// match any 'Welcome bonus…' entry so those accounts don't get a second one.
const WELCOME_DESCRIPTION = 'Welcome bonus — 20 starter Focus Coins!';
const WELCOME_MATCH = { type: 'bonus', description: { $regex: '^Welcome bonus' } };

async function ensureWelcomeBonus(user) {
  if (!user?._id || WELCOME_BONUS <= 0) return;
  const createdAt = user.createdAt ? new Date(user.createdAt) : new Date();
  await CoinTransaction.updateOne(
    { userId: user._id, ...WELCOME_MATCH },
    {
      $setOnInsert: {
        userId: user._id,
        type: 'bonus',
        amount: WELCOME_BONUS,
        balanceAfter: WELCOME_BONUS,
        description: WELCOME_DESCRIPTION,
        createdAt,
        updatedAt: createdAt,
      },
    },
    { upsert: true, timestamps: false }
  );
}

/** The user's welcome-bonus entry, if any (for the Coins page). */
const findWelcomeBonus = (userId) => CoinTransaction.findOne({ userId, ...WELCOME_MATCH }).select('amount createdAt').lean();

module.exports = { ensureWelcomeBonus, findWelcomeBonus, WELCOME_BONUS, WELCOME_DESCRIPTION };
