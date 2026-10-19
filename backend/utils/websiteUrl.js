/**
 * Blocked-site helpers shared by the websites API and the AI assistant, so a
 * site the assistant proposes is stored exactly as one added in Settings.
 */

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

/** Strip protocol, www. and trailing slashes, lowercase: "https://www.YouTube.com/" → "youtube.com". */
function normaliseWebsiteUrl(websiteUrl) {
  return String(websiteUrl)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

// A bare domain such as "news.ycombinator.com" (no path, port or spaces)
const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const isValidDomain = (domain) => DOMAIN_RE.test(domain);

function guessCategory(domain) {
  for (const [category, domains] of Object.entries(KNOWN_CATEGORIES)) {
    if (domains.some((d) => domain === d || domain.endsWith('.' + d))) return category;
  }
  return 'other';
}

module.exports = { KNOWN_CATEGORIES, normaliseWebsiteUrl, isValidDomain, guessCategory };
