/**
 * DistractFree — Service Worker (background.js)
 * ==============================================
 *
 * Responsibilities:
 *  1. Monitor tab navigation events.
 *  2. Check URLs against the user's blocked-site list.
 *  3. Redirect blocked sites to block.html.
 *  4. Log browsing activity to the backend.
 *  5. Manage focus session state and timer.
 *  6. Sync blocked-sites list from the backend on session start.
 */

const API_BASE = 'http://localhost:5000/api';

// ── State ──────────────────────────────────────────
let blockedSites = [];
let activeSession = null;
let authToken = null;
let sessionTimer = null;
let temporarilyUnlocked = new Set(); // URLs unlocked with coins

// ── Initialisation ─────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log('[DistractFree] Extension installed');
  loadFromStorage();
});

chrome.runtime.onStartup.addListener(() => {
  loadFromStorage();
});

async function loadFromStorage() {
  const data = await chrome.storage.local.get([
    'authToken',
    'blockedSites',
    'activeSession',
  ]);

  authToken = data.authToken || null;
  blockedSites = data.blockedSites || [];
  activeSession = data.activeSession || null;

  if (activeSession) {
    startSessionTimer();
  }
}

// ── Auth helpers ───────────────────────────────────

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
  };
}

async function apiRequest(endpoint, options = {}) {
  if (!authToken) throw new Error('Not authenticated');

  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: getAuthHeaders(),
    ...options,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `API error ${response.status}`);
  }

  return response.json();
}

// ── Blocked-site sync ──────────────────────────────

async function syncBlockedSites() {
  try {
    const data = await apiRequest('/websites/list');
    blockedSites = (data.websites || [])
      .filter((w) => w.isActive)
      .map((w) => ({
        id: w._id,
        url: w.websiteUrl,
        category: w.category,
        displayName: w.displayName,
      }));

    await chrome.storage.local.set({ blockedSites });
    console.log('[DistractFree] Synced', blockedSites.length, 'blocked sites');
  } catch (err) {
    console.error('[DistractFree] Sync failed:', err.message);
  }
}

// ── URL matching ───────────────────────────────────

function extractHostname(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function isBlocked(url) {
  if (!activeSession) return false;

  const hostname = extractHostname(url);
  if (!hostname) return false;

  // Check temporarily unlocked
  if (temporarilyUnlocked.has(hostname)) return false;

  return blockedSites.some((site) => {
    return hostname === site.url || hostname.endsWith('.' + site.url);
  });
}

function getBlockedSiteInfo(url) {
  const hostname = extractHostname(url);
  return blockedSites.find(
    (site) => hostname === site.url || hostname.endsWith('.' + site.url)
  );
}

// ── Navigation listener ───────────────────────────

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only handle main frame navigations
  if (details.frameId !== 0) return;
  if (!activeSession) return;

  const url = details.url;

  // Skip internal pages
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:')
  ) {
    return;
  }

  if (isBlocked(url)) {
    const siteInfo = getBlockedSiteInfo(url);

    // Redirect to block page
    const blockPageUrl = chrome.runtime.getURL('block.html');
    const params = new URLSearchParams({
      url: url,
      site: siteInfo?.displayName || extractHostname(url),
      siteId: siteInfo?.id || '',
      remaining: getRemainingTime(),
    });

    chrome.tabs.update(details.tabId, {
      url: `${blockPageUrl}?${params.toString()}`,
    });

    // Log the blocked attempt
    logBrowsingEvent(url, true, false);
  }
});

// ── Tab activity tracking ──────────────────────────

let activeTabUrl = '';
let activeTabStartTime = Date.now();

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Record time on previous tab
  if (activeTabUrl && activeSession) {
    const duration = Math.round((Date.now() - activeTabStartTime) / 1000);
    if (duration > 2) {
      logBrowsingEvent(activeTabUrl, false, false, duration);
    }
  }

  // Track new active tab
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    activeTabUrl = tab.url || '';
    activeTabStartTime = Date.now();
  } catch {
    activeTabUrl = '';
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    activeTabUrl = changeInfo.url;
    activeTabStartTime = Date.now();
  }
});

// ── Browsing log ───────────────────────────────────

async function logBrowsingEvent(url, wasBlocked = false, wasUnlocked = false, duration = 0) {
  if (!authToken || !activeSession) return;

  const hostname = extractHostname(url);
  if (!hostname) return;

  const siteInfo = getBlockedSiteInfo(url);

  try {
    await apiRequest('/insights/browsing/log', {
      method: 'POST',
      body: JSON.stringify({
        website: hostname,
        fullUrl: url,
        duration,
        wasBlocked,
        wasUnlocked,
        category: siteInfo?.category || 'other',
        sessionId: activeSession.sessionId,
      }),
    });
  } catch (err) {
    console.warn('[DistractFree] Failed to log browse event:', err.message);
  }
}

// ── Focus session management ───────────────────────

async function startFocusSession(plannedDuration) {
  try {
    const data = await apiRequest('/session/start', {
      method: 'POST',
      body: JSON.stringify({ plannedDuration }),
    });

    activeSession = {
      sessionId: data.session._id,
      startTime: Date.now(),
      plannedDuration,
      blockedSites: data.session.blockedSitesUsed,
    };

    await chrome.storage.local.set({ activeSession });
    await syncBlockedSites();
    temporarilyUnlocked.clear();
    startSessionTimer();

    return { success: true, session: data.session };
  } catch (err) {
    console.error('[DistractFree] Failed to start session:', err.message);
    return { success: false, message: err.message };
  }
}

async function endFocusSession(cancelled = false) {
  if (!activeSession) return { success: false, message: 'No active session' };

  try {
    const data = await apiRequest('/session/end', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: activeSession.sessionId,
        cancelled,
      }),
    });

    activeSession = null;
    temporarilyUnlocked.clear();
    await chrome.storage.local.remove('activeSession');
    stopSessionTimer();

    return { success: true, session: data.session };
  } catch (err) {
    console.error('[DistractFree] Failed to end session:', err.message);
    return { success: false, message: err.message };
  }
}

// ── Timer ──────────────────────────────────────────

function startSessionTimer() {
  if (!activeSession) return;

  // Use chrome.alarms for MV3 service worker persistence
  chrome.alarms.create('sessionEnd', {
    delayInMinutes: activeSession.plannedDuration,
  });
}

function stopSessionTimer() {
  chrome.alarms.clear('sessionEnd');
}

function getRemainingTime() {
  if (!activeSession) return '00:00';

  const elapsed = Math.round((Date.now() - activeSession.startTime) / 1000);
  const totalSeconds = activeSession.plannedDuration * 60;
  const remaining = Math.max(0, totalSeconds - elapsed);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sessionEnd') {
    endFocusSession(false);
    // Notify the user
    chrome.notifications?.create('sessionComplete', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Focus Session Complete! 🎉',
      message: 'Great job! Your focus session has ended. Check your earned coins!',
    });
  }
});

// ── Unlock website with coins ──────────────────────

async function unlockWebsite(websiteId, websiteUrl) {
  try {
    const data = await apiRequest('/websites/unlock', {
      method: 'POST',
      body: JSON.stringify({ websiteId }),
    });

    // Temporarily allow the URL for this session
    const hostname = extractHostname(websiteUrl) || websiteUrl;
    temporarilyUnlocked.add(hostname);

    return { success: true, remainingCoins: data.remainingCoins };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ── Message handler (popup ↔ service worker) ───────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    LOGIN: async () => {
      authToken = message.token;
      await chrome.storage.local.set({ authToken: message.token });
      await syncBlockedSites();
      sendResponse({ success: true });
    },

    LOGOUT: async () => {
      authToken = null;
      activeSession = null;
      blockedSites = [];
      temporarilyUnlocked.clear();
      await chrome.storage.local.clear();
      sendResponse({ success: true });
    },

    START_SESSION: async () => {
      const result = await startFocusSession(message.plannedDuration);
      sendResponse(result);
    },

    END_SESSION: async () => {
      const result = await endFocusSession(message.cancelled || false);
      sendResponse(result);
    },

    GET_STATUS: async () => {
      sendResponse({
        isAuthenticated: !!authToken,
        activeSession: activeSession
          ? {
              ...activeSession,
              remainingTime: getRemainingTime(),
            }
          : null,
        blockedSitesCount: blockedSites.length,
      });
    },

    UNLOCK_WEBSITE: async () => {
      const result = await unlockWebsite(message.websiteId, message.websiteUrl);
      sendResponse(result);
    },

    SYNC_BLOCKED_SITES: async () => {
      await syncBlockedSites();
      sendResponse({ success: true, count: blockedSites.length });
    },

    CHECK_URL: async () => {
      const blocked = isBlocked(message.url);
      sendResponse({ blocked });
    },

    /**
     * Receive time-on-page data from content.js.
     * Logs the browsing duration to the backend.
     */
    PAGE_TIME: async () => {
      if (message.url && message.duration > 0) {
        logBrowsingEvent(message.url, false, false, message.duration);
      }
      sendResponse({ received: true });
    },

    /**
     * Refresh coin balance — called by block page after an unlock.
     */
    REFRESH_COINS: async () => {
      try {
        const data = await apiRequest('/coins/balance');
        sendResponse({ success: true, focusCoins: data.focusCoins });
      } catch (err) {
        sendResponse({ success: false, message: err.message });
      }
    },
  };

  if (handlers[message.type]) {
    handlers[message.type]();
    return true; // keep message channel open for async response
  }
});
