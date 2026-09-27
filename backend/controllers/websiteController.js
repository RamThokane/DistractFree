const BlockedWebsite = require('../models/BlockedWebsite');
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const FocusSession = require('../models/FocusSession');
const { UNLOCK_COST } = require('../utils/coinCalculator');
const { createNotification } = require('./notificationController');

// Known distracting domains → category (feeds analytics and the ML model)
const KNOWN_CATEGORIES = {
  social_media: ['facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'tiktok.com', 'snapchat.com', 'linkedin.com', 'pinterest.com', 'reddit.com', 'threads.net'],
  streaming: ['youtube.com', 'netflix.com', 'primevideo.com', 'hotstar.com', 'twitch.tv', 'disneyplus.com', 'hulu.com', 'jiocinema.com'],
  entertainment: ['9gag.com', 'imgur.com', 'buzzfeed.com', 'spotify.com'],
  news: ['cnn.com', 'bbc.com', 'news.google.com', 'ndtv.com', 'timesofindia.indiatimes.com', 'nytimes.com'],
  shopping: ['amazon.com', 'amazon.in', 'flipkart.com', 'myntra.com', 'ebay.com', 'meesho.com'],
  gaming: ['steampowered.com', 'epicgames.com', 'roblox.com', 'chess.com', 'miniclip.com'],
  messaging: ['web.whatsapp.com', 'whatsapp.com', 'discord.com', 'telegram.org', 'messenger.com'],
};

function guessCategory(domain) {
  for (const [category, domains] of Object.entries(KNOWN_CATEGORIES)) {
    if (domains.some((d) => domain === d || domain.endsWith('.' + d))) return category;
  }
  return 'other';
}

// ────────────────────────────────────────────────────
// POST /api/websites/add
// ────────────────────────────────────────────────────
exports.addWebsite = async (req, res) => {
  try {
    const userId = req.user._id;
    const { websiteUrl, displayName, category } = req.body;

    if (!websiteUrl) {
      return res.status(400).json({
        success: false,
        message: 'websiteUrl is required',
      });
    }

    // Normalise URL — strip protocol and trailing slash
    const normalised = websiteUrl
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '')
      .toLowerCase();

    // Check for duplicate
    const existing = await BlockedWebsite.findOne({ userId, websiteUrl: normalised });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'This website is already in your blocked list',
      });
    }

    const website = await BlockedWebsite.create({
      userId,
      websiteUrl: normalised,
      displayName: displayName || normalised,
      category: category && category !== 'other' ? category : guessCategory(normalised),
    });

    // Push ref to user's blockedWebsites array
    await User.findByIdAndUpdate(userId, {
      $addToSet: { blockedWebsites: website._id },
    });

    res.status(201).json({ success: true, website });
  } catch (error) {
    console.error('[Website] Add error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// DELETE /api/websites/remove
// ────────────────────────────────────────────────────
exports.removeWebsite = async (req, res) => {
  try {
    const userId = req.user._id;
    const { websiteId } = req.body;

    if (!websiteId) {
      return res.status(400).json({
        success: false,
        message: 'websiteId is required',
      });
    }

    const website = await BlockedWebsite.findOneAndDelete({
      _id: websiteId,
      userId,
    });

    if (!website) {
      return res.status(404).json({
        success: false,
        message: 'Website not found in your blocked list',
      });
    }

    await User.findByIdAndUpdate(userId, {
      $pull: { blockedWebsites: websiteId },
    });

    res.json({ success: true, message: 'Website removed from blocked list' });
  } catch (error) {
    console.error('[Website] Remove error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/websites/list
// ────────────────────────────────────────────────────
exports.listWebsites = async (req, res) => {
  try {
    const websites = await BlockedWebsite.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });

    res.json({ success: true, websites });
  } catch (error) {
    console.error('[Website] List error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// PATCH /api/websites/toggle/:id
// ────────────────────────────────────────────────────
exports.toggleWebsite = async (req, res) => {
  try {
    const website = await BlockedWebsite.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!website) {
      return res.status(404).json({ success: false, message: 'Website not found' });
    }

    website.isActive = !website.isActive;
    await website.save();

    res.json({ success: true, website });
  } catch (error) {
    console.error('[Website] Toggle error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// POST /api/websites/unlock
// Spend coins to temporarily unlock a blocked site during a session
// ────────────────────────────────────────────────────
exports.unlockWebsite = async (req, res) => {
  try {
    const userId = req.user._id;
    const { websiteId } = req.body;

    const user = await User.findById(userId);

    // Strict mode: no coin unlocks at all, in or out of a session
    if (user.settings?.strictMode) {
      return res.status(403).json({
        success: false,
        message: 'Strict Mode is enabled. Blocked sites cannot be unlocked with coins.',
      });
    }

    const activeSession = await FocusSession.findOne({ userId, status: 'active' });

    if (user.focusCoins < UNLOCK_COST) {
      return res.status(403).json({
        success: false,
        message: `Insufficient coins. You need ${UNLOCK_COST} coins to unlock a website.`,
      });
    }

    const website = await BlockedWebsite.findOne({ _id: websiteId, userId });
    if (!website) {
      return res.status(404).json({ success: false, message: 'Website not found' });
    }

    // Deduct coins
    user.focusCoins -= UNLOCK_COST;
    await user.save();

    // Record transaction
    await CoinTransaction.create({
      userId,
      type: 'spent',
      amount: -UNLOCK_COST,
      balanceAfter: user.focusCoins,
      description: `Unlocked ${website.websiteUrl}${activeSession ? ' during focus session' : ''}`,
      sessionId: activeSession ? activeSession._id : null,
    });

    await createNotification(
      userId,
      'coins_spent',
      '🪙 Coins Spent',
      `You spent ${UNLOCK_COST} coins to unlock ${website.websiteUrl} for 2 minutes. Balance: ${user.focusCoins}.`,
      { website: website.websiteUrl, amount: UNLOCK_COST }
    );

    // Record spending on active session
    if (activeSession) {
      activeSession.coinsSpent += UNLOCK_COST;
      await activeSession.save();
    }

    res.json({
      success: true,
      message: `${website.websiteUrl} unlocked. ${UNLOCK_COST} coins deducted.`,
      remainingCoins: user.focusCoins,
    });
  } catch (error) {
    console.error('[Website] Unlock error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
