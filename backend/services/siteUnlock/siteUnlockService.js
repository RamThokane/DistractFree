/**
 * Strict-mode unlocks during a focus session.
 *
 * Only while BOTH a focus session is running and strict mode is on:
 *   1. Each blocked site gets one free 2-minute grace pass per session.
 *   2. After that the site can be unlocked until the session ends for ₹49,
 *      which is donated to charity. No refunds.
 *
 * Outside that (no session, or strict mode off) blocking is unchanged.
 * Passes and unlocks live on the FocusSession, so they reset with every new session.
 */

const FocusSession = require('../../models/FocusSession');
const BlockedWebsite = require('../../models/BlockedWebsite');
const { normaliseWebsiteUrl } = require('../../utils/websiteUrl');
const { createNotification } = require('../../controllers/notificationController');

const PASS_MINUTES = 2;
const PASS_MS = PASS_MINUTES * 60 * 1000;
const UNLOCK_PRICE_INR = 49;

class UnlockError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const sessionEndsAt = (session) => new Date(new Date(session.startTime).getTime() + session.plannedDuration * 60000);

/** The running session when the user is in strict mode, else null. */
async function strictSessionFor(user) {
  if (!user?.settings?.strictMode) return null;
  return FocusSession.findOne({ userId: user._id, status: 'active' });
}

async function requireStrictSession(user) {
  if (!user?.settings?.strictMode) throw new UnlockError('This is only available in strict mode.', 403, 'NOT_STRICT');
  const session = await strictSessionFor(user);
  if (!session) throw new UnlockError('This is only available during a focus session.', 409, 'NO_SESSION');
  return session;
}

/**
 * The user's active blocklist entry that covers `raw` (a domain or hostname),
 * so "m.youtube.com" and "youtube.com" share one pass.
 */
async function blockedDomainFor(userId, raw) {
  const host = normaliseWebsiteUrl(raw || '').split('/')[0];
  if (!host) throw new UnlockError('Which site?', 400, 'BAD_DOMAIN');
  const sites = await BlockedWebsite.find({ userId, isActive: true }).select('websiteUrl').lean();
  const match = sites
    .map((s) => s.websiteUrl)
    .filter((url) => host === url || host.endsWith('.' + url))
    .sort((a, b) => b.length - a.length)[0];
  if (!match) throw new UnlockError('That site isn’t on your block list.', 404, 'NOT_BLOCKED');
  return match;
}

/** What the extension and the unlock page need to know about this session. */
function unlockStatus(session, now = new Date()) {
  if (!session) return { focusStrict: false };
  return {
    focusStrict: true,
    sessionId: String(session._id),
    sessionEndsAt: sessionEndsAt(session),
    passes: (session.gracePasses || []).map((p) => ({ domain: p.domain, expiresAt: p.expiresAt, active: p.expiresAt > now })),
    paidDomains: (session.paidUnlocks || []).map((u) => u.domain),
  };
}

/**
 * Use the one free pass for a site. Atomic: two tabs racing get one pass.
 * @returns {Promise<{ domain: string, expiresAt: Date, session }>}
 */
async function startPass(user, rawDomain, now = new Date()) {
  const session = await requireStrictSession(user);
  const domain = await blockedDomainFor(user._id, rawDomain);
  if ((session.paidUnlocks || []).some((u) => u.domain === domain)) {
    throw new UnlockError(`${domain} is already unlocked for this session.`, 409, 'ALREADY_UNLOCKED');
  }

  const expiresAt = new Date(now.getTime() + PASS_MS);
  const updated = await FocusSession.findOneAndUpdate(
    { _id: session._id, status: 'active', 'gracePasses.domain': { $ne: domain } },
    { $push: { gracePasses: { domain, startedAt: now, expiresAt } } },
    { new: true }
  );
  if (!updated) {
    throw new UnlockError(`You've already used your free pass for ${domain} this session.`, 409, 'PASS_USED');
  }
  return { domain, expiresAt, session: updated };
}

/**
 * Check a ₹49 unlock can be bought now: the free pass is used up and the site
 * isn't unlocked yet. @returns {Promise<{ domain: string, session }>}
 */
async function checkUnlockOrder(user, rawDomain, now = new Date()) {
  const session = await requireStrictSession(user);
  const domain = await blockedDomainFor(user._id, rawDomain);
  if ((session.paidUnlocks || []).some((u) => u.domain === domain)) {
    throw new UnlockError(`${domain} is already unlocked for this session.`, 409, 'ALREADY_UNLOCKED');
  }
  const pass = (session.gracePasses || []).find((p) => p.domain === domain);
  if (!pass) throw new UnlockError(`You still have a free 2-minute pass for ${domain}.`, 409, 'PASS_AVAILABLE');
  if (pass.expiresAt > now) throw new UnlockError(`Your free pass for ${domain} is still running.`, 409, 'PASS_RUNNING');
  return { domain, session };
}

/**
 * A paid site_unlock order: open the site until its session ends. Safe to call
 * twice. Recorded even if the session has ended meanwhile (no refunds).
 */
async function grantUnlock(payment) {
  const granted = await FocusSession.updateOne(
    { _id: payment.sessionId, 'paidUnlocks.domain': { $ne: payment.domain } },
    { $push: { paidUnlocks: { domain: payment.domain, orderId: payment.orderId, paidAt: payment.paidAt || new Date() } } }
  );
  if (granted.modifiedCount) {
    await createNotification(
      payment.userId,
      'system',
      `${payment.domain} unlocked`,
      `Your ₹${payment.amount} goes to charity. ${payment.domain} stays open until this focus session ends.`
    );
  }
}

module.exports = {
  PASS_MINUTES,
  PASS_MS,
  UNLOCK_PRICE_INR,
  UnlockError,
  sessionEndsAt,
  strictSessionFor,
  blockedDomainFor,
  unlockStatus,
  startPass,
  checkUnlockOrder,
  grantUnlock,
};
