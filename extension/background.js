/**
 * DistractFree — Service Worker (background.js)
 * ==============================================
 *
 * Responsibilities:
 *  1. Monitor tab navigation events.
 *  2. Check URLs against the user's blocked-site list.
 *  3. Redirect blocked sites to block.html — ALWAYS (not just during sessions).
 *  4. Log browsing activity to the backend.
 *  5. Manage focus session state and timer.
 *  6. Sync blocked-sites list from the backend on login and periodically.
 */

const API_BASE = 'http://localhost:5000/api';

// ── State ──────────────────────────────────────────
let blockedSites = [];
let activeSession = null;
let authToken = null;
let temporarilyUnlocked = new Map(); // URLs unlocked with coins -> Expiry timestamp

// ML Telemetry tracking
let sessionTelemetry = {
  tabSwitches: 0,
  interruptions: 0,
  blockAttempts: 0,
};
let liveSyncInterval = null;

// ── Initialisation ─────────────────────────────────

const loadPromise = loadFromStorage();

chrome.runtime.onInstalled.addListener(() => {
  console.log('[DistractFree] Extension installed');
});

chrome.runtime.onStartup.addListener(async () => {
  await loadPromise;
  // Re-sync blocked sites on browser startup
  if (authToken) {
    await syncBlockedSites();
  }
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

  console.log('[DistractFree] Loaded from storage:', {
    authenticated: !!authToken,
    blockedCount: blockedSites.length,
    hasSession: !!activeSession,
  });

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
      .filter((w) => w.isActive !== false)
      .map((w) => ({
        id: w._id,
        url: (w.websiteUrl || '')
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/+$/, '')
          .toLowerCase(),
        category: w.category,
        displayName: w.displayName || w.websiteUrl,
      }));

    await chrome.storage.local.set({ blockedSites });
    console.log('[DistractFree] Synced', blockedSites.length, 'blocked sites:', blockedSites.map(s => s.url));
    return blockedSites.length;
  } catch (err) {
    console.error('[DistractFree] Sync failed:', err.message);
    return 0;
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

/**
 * Check if a URL is blocked.
 * Sites are blocked ALWAYS when in the blocked list (not just during sessions).
 * The user must be authenticated and have blocked sites configured.
 */
function isBlocked(url) {
  // Must be authenticated
  if (!authToken) return false;

  // Must have blocked sites
  if (blockedSites.length === 0) return false;

  const hostname = extractHostname(url);
  if (!hostname) return false;

  // Check temporarily unlocked
  if (temporarilyUnlocked.has(hostname)) {
    if (Date.now() < temporarilyUnlocked.get(hostname)) {
      return false; // Still unlocked
    } else {
      temporarilyUnlocked.delete(hostname); // Expired
    }
  }

  return blockedSites.some((site) => {
    const siteUrl = site.url;
    return hostname === siteUrl || hostname.endsWith('.' + siteUrl);
  });
}

function getBlockedSiteInfo(url) {
  const hostname = extractHostname(url);
  return blockedSites.find(
    (site) => hostname === site.url || hostname.endsWith('.' + site.url)
  );
}

// ── Navigation listener — BLOCKS ALWAYS ───────────

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  await loadPromise;

  // Only handle main frame navigations
  if (details.frameId !== 0) return;

  const url = details.url;

  // Skip internal pages
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('edge://') ||
    url.startsWith('brave://')
  ) {
    return;
  }

  // Skip localhost (our own dashboard)
  if (url.includes('localhost:3000') || url.includes('localhost:5000')) {
    return;
  }

  if (isBlocked(url)) {
    const siteInfo = getBlockedSiteInfo(url);

    console.log('[DistractFree] BLOCKING:', url, '→ matched', siteInfo?.url);

    // Redirect to block page
    const blockPageUrl = chrome.runtime.getURL('block.html');
    const params = new URLSearchParams({
      url: url,
      site: siteInfo?.displayName || extractHostname(url),
      siteId: siteInfo?.id || '',
      remaining: activeSession ? getRemainingTime() : 'always',
    });

    chrome.tabs.update(details.tabId, {
      url: `${blockPageUrl}?${params.toString()}`,
    });

    // Log the blocked attempt (only during sessions)
    if (activeSession) {
      logBrowsingEvent(url, true, false);
      sessionTelemetry.blockAttempts += 1;
    }
  }
});

// Also check when tab URL changes (handles redirects, SPA navigations)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await loadPromise;

  if (changeInfo.url && changeInfo.url.startsWith('http')) {
    // Don't re-block if already on block page
    if (changeInfo.url.includes('block.html')) return;
    if (changeInfo.url.includes('localhost:3000') || changeInfo.url.includes('localhost:5000')) return;

    if (isBlocked(changeInfo.url)) {
      const siteInfo = getBlockedSiteInfo(changeInfo.url);
      console.log('[DistractFree] BLOCKING (tab update):', changeInfo.url);

      const blockPageUrl = chrome.runtime.getURL('block.html');
      const params = new URLSearchParams({
        url: changeInfo.url,
        site: siteInfo?.displayName || extractHostname(changeInfo.url),
        siteId: siteInfo?.id || '',
        remaining: activeSession ? getRemainingTime() : 'always',
      });

      chrome.tabs.update(tabId, {
        url: `${blockPageUrl}?${params.toString()}`,
      });
    }
  }
});

// ── Tab activity tracking ──────────────────────────

let activeTabUrl = '';
let activeTabStartTime = Date.now();

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await loadPromise;
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
    
    // ML Tracking
    if (activeSession) {
      sessionTelemetry.tabSwitches += 1;
      // If navigating to non-work sites, consider it an interruption
      if (activeTabUrl.includes('youtube.com') || activeTabUrl.includes('twitter.com') || activeTabUrl.includes('instagram.com')) {
         sessionTelemetry.interruptions += 1;
      }
    }
  } catch {
    activeTabUrl = '';
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

async function startFocusSession(plannedDuration, selectedSiteIds) {
  try {
    // First sync blocked sites to make sure we have the latest list
    await syncBlockedSites();

    const data = await apiRequest('/session/start', {
      method: 'POST',
      body: JSON.stringify({ plannedDuration }),
    });

    const serverTime = data.serverTime ? new Date(data.serverTime).getTime() : Date.now();
    const elapsedSecs = Math.max(0, Math.floor((serverTime - new Date(data.session.startTime).getTime()) / 1000));

    activeSession = {
      sessionId: data.session._id,
      startTime: Date.now() - (elapsedSecs * 1000),
      plannedDuration,
      blockedSites: selectedSiteIds || data.session.blockedSitesUsed,
    };

    // If there were explicit site selections, we filter our global blockedSites 
    // down to ONLY what was selected for this session, UNLESS global setting overrides.
    // However, the user simply requested it asks what to block.
    // For now we store it.

    await chrome.storage.local.set({ activeSession });
    temporarilyUnlocked.clear();
    
    // ML Tracking Reset & Start
    sessionTelemetry = { tabSwitches: 0, interruptions: 0, blockAttempts: 0 };
    startLiveSync();

    startSessionTimer();

    console.log('[DistractFree] Session started:', plannedDuration, 'min');
    return { success: true, session: data.session };
  } catch (err) {
    if (err.message.includes('409') || err.message.toLowerCase().includes('already have an active')) {
      console.warn('[DistractFree] Backend thinks we have an active session. Syncing with it.');
      // Fetch the active session from backend
      try {
        const activeData = await apiRequest('/session/active');
        if (activeData && activeData.session) {
          const serverTime = activeData.serverTime ? new Date(activeData.serverTime).getTime() : Date.now();
          const elapsedSecs = Math.max(0, Math.floor((serverTime - new Date(activeData.session.startTime).getTime()) / 1000));

          activeSession = {
            sessionId: activeData.session._id,
            startTime: Date.now() - (elapsedSecs * 1000),
            plannedDuration: activeData.session.plannedDuration,
            blockedSites: activeData.session.blockedSitesUsed || [],
          };
          await chrome.storage.local.set({ activeSession });
          temporarilyUnlocked.clear();
          startSessionTimer();
          return { success: true, session: activeData.session };
        }
      } catch (syncErr) {
        console.error('[DistractFree] Failed to sync active session:', syncErr);
      }
      return { success: false, code: 409, message: 'You already have an active focus session running. Please complete or cancel it from the dashboard.' };
    }
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
    stopLiveSync();

    return { success: true, session: data.session };
  } catch (err) {
    console.error('[DistractFree] Failed to end session:', err.message);
    return { success: false, message: err.message };
  }
}

// ── Timer & ML Telemetry ──────────────────────────

function startLiveSync() {
  if (liveSyncInterval) clearInterval(liveSyncInterval);
  // Sync ML data every 10 seconds
  liveSyncInterval = setInterval(async () => {
    if (!activeSession) return;
    const elapsedMinutes = Math.round((Date.now() - activeSession.startTime) / 60000);
    try {
      await apiRequest('/session/live-update', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: activeSession.sessionId,
          duration: elapsedMinutes,
          tabSwitches: sessionTelemetry.tabSwitches,
          interruptions: sessionTelemetry.interruptions,
          blockAttempts: sessionTelemetry.blockAttempts
        })
      });
      console.log('[ML Sync] Sent live data:', sessionTelemetry);
    } catch(e) {
      console.warn('[ML Sync] Failed:', e.message);
    }
  }, 10000);
}

function stopLiveSync() {
  if (liveSyncInterval) clearInterval(liveSyncInterval);
}

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

chrome.alarms.onAlarm.addListener(async (alarm) => {
  await loadPromise;
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

    // Temporarily allow the URL for 2 minutes
    const hostname = extractHostname(websiteUrl) || websiteUrl;
    temporarilyUnlocked.set(hostname, Date.now() + 2 * 60 * 1000);

    console.log('[DistractFree] Unlocked:', hostname);
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
      console.log('[DistractFree] Logged in, synced sites');
      sendResponse({ success: true });
    },

    LOGOUT: async () => {
      authToken = null;
      activeSession = null;
      blockedSites = [];
      temporarilyUnlocked.clear();
      await chrome.storage.local.clear();
      console.log('[DistractFree] Logged out');
      sendResponse({ success: true });
    },

    START_SESSION: async () => {
      const result = await startFocusSession(message.plannedDuration, message.selectedSites);
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
        blockedSites: blockedSites
      });
    },

    GET_USER: async () => {
      try {
        const data = await apiRequest('/auth/me');
        sendResponse({ success: true, user: data.user });
      } catch (err) {
        sendResponse({ success: false, message: err.message });
      }
    },

    UNLOCK_WEBSITE: async () => {
      const result = await unlockWebsite(message.websiteId, message.websiteUrl);
      sendResponse(result);
    },

    SYNC_BLOCKED_SITES: async () => {
      const count = await syncBlockedSites();
      sendResponse({ success: true, count });
    },

    CHECK_URL: async () => {
      const blocked = isBlocked(message.url);
      const hostname = extractHostname(message.url);
      const unlockExpiry = temporarilyUnlocked.has(hostname) ? temporarilyUnlocked.get(hostname) : null;
      sendResponse({ blocked, unlockExpiry });
    },

    PAGE_TIME: async () => {
      if (message.url && message.duration > 0) {
        logBrowsingEvent(message.url, false, false, message.duration);
      }
      sendResponse({ received: true });
    },

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
    loadPromise.then(() => handlers[message.type]());
    return true; // keep message channel open for async response
  }
});
