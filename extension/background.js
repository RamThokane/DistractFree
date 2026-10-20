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

// ── Configuration ─────────────────────────────────
// API_BASE / DASHBOARD_ORIGIN default to production and can be overridden from
// the popup settings (stored as apiBase / dashboardOrigin), e.g. for local
// development: http://localhost:5000/api and http://localhost:3000
const DEFAULT_API_BASE = 'https://api.distractfree.site/api';
const DEFAULT_DASHBOARD_ORIGIN = 'https://distractfree.site';

let API_BASE = DEFAULT_API_BASE;
let DASHBOARD_ORIGIN = DEFAULT_DASHBOARD_ORIGIN;

// High-distraction site patterns (used for ML telemetry interruption detection)
const DISTRACTION_DOMAINS = [
  'youtube.com', 'twitter.com', 'x.com', 'instagram.com',
  'tiktok.com', 'reddit.com', 'facebook.com', 'snapchat.com',
];

// ── State ──────────────────────────────────────────
let blockedSites = [];
let activeSession = null;
let authToken = null;
let temporarilyUnlocked = new Map(); // URLs unlocked with coins -> Expiry timestamp
let strictMode = false; // mirrors user.settings.strictMode — no coin unlocks while on

// Live-state telemetry for the running session. Kept in chrome.storage too:
// the MV3 service worker is stopped when idle, which would lose in-memory
// counts (and then overwrite the server's counts with zeros).
const EMPTY_TELEMETRY = { tabSwitches: 0, interruptions: 0, blockAttempts: 0 };
let sessionTelemetry = { ...EMPTY_TELEMETRY };
let liveSyncInterval = null;
let telemetryPushTimer = null;
// Recent blocked navigations, so one attempt seen by two listeners counts once
const recentBlocks = new Map();

// ── Initialisation ─────────────────────────────────

const loadPromise = loadFromStorage();

// Periodically re-sync the block list + settings so sites added on the
// website are blocked right away, even when no focus session is running.
const SYNC_ALARM = 'syncBlockedSites';
function ensureSyncAlarm() {
  chrome.alarms.get(SYNC_ALARM, (alarm) => {
    if (!alarm) chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 1 });
  });
}
ensureSyncAlarm();

chrome.runtime.onInstalled.addListener(() => {
  console.log('[DistractFree] Extension installed');
  ensureSyncAlarm();
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
    'apiBase',
    'dashboardOrigin',
    'strictMode',
    'sessionTelemetry',
  ]);

  authToken = data.authToken || null;
  blockedSites = data.blockedSites || [];
  activeSession = data.activeSession || null;
  strictMode = !!data.strictMode;

  // Allow overriding API base from storage (set by popup)
  if (data.apiBase) API_BASE = data.apiBase;
  if (data.dashboardOrigin) DASHBOARD_ORIGIN = data.dashboardOrigin;

  console.log('[DistractFree] Loaded from storage:', {
    authenticated: !!authToken,
    blockedCount: blockedSites.length,
    hasSession: !!activeSession,
    apiBase: API_BASE,
  });

  if (activeSession) {
    // Counts survive a service-worker restart
    if (data.sessionTelemetry?.sessionId === activeSession.sessionId) {
      const { sessionId, ...counts } = data.sessionTelemetry;
      sessionTelemetry = { ...EMPTY_TELEMETRY, ...counts };
    }
    startSessionTimer();
    startLiveSync();
  }
}

// ── Live-state telemetry ───────────────────────────

/** Start counting for a session; keeps the stored counts if it is the same session. */
async function resetTelemetry(sessionId) {
  const { sessionTelemetry: stored } = await chrome.storage.local.get('sessionTelemetry');
  if (stored?.sessionId === sessionId) {
    const { sessionId: _id, ...counts } = stored;
    sessionTelemetry = { ...EMPTY_TELEMETRY, ...counts };
  } else {
    sessionTelemetry = { ...EMPTY_TELEMETRY };
    await chrome.storage.local.set({ sessionTelemetry: { ...sessionTelemetry, sessionId } });
  }
}

/** Count one event for the running session, save it, and send it to the server shortly. */
function bumpTelemetry(field) {
  if (!activeSession) return;
  sessionTelemetry[field] += 1;
  chrome.storage.local.set({ sessionTelemetry: { ...sessionTelemetry, sessionId: activeSession.sessionId } });
  // Debounced so a burst of tab switches is one request; the card updates within seconds
  clearTimeout(telemetryPushTimer);
  telemetryPushTimer = setTimeout(pushTelemetry, 2000);
}

/** Send the session's counts so far; the server turns them into the live status. */
async function pushTelemetry() {
  if (!activeSession || !authToken) return;
  const elapsedMinutes = Math.round((Date.now() - activeSession.startTime) / 60000);
  try {
    await apiRequest('/session/live-update', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: activeSession.sessionId,
        duration: elapsedMinutes,
        tabSwitches: sessionTelemetry.tabSwitches,
        interruptions: sessionTelemetry.interruptions,
        blockAttempts: sessionTelemetry.blockAttempts,
      }),
    });
  } catch (e) {
    console.warn('[Live Sync] Failed:', e.message);
  }
}

/** Count a blocked attempt once, even when two navigation listeners both see it. */
function countBlockedAttempt(tabId, url) {
  if (!activeSession) return;
  const key = `${tabId}|${extractHostname(url)}`;
  const now = Date.now();
  if (now - (recentBlocks.get(key) || 0) < 5000) return;
  recentBlocks.set(key, now);
  for (const [k, t] of recentBlocks) if (now - t > 60000) recentBlocks.delete(k);
  bumpTelemetry('blockAttempts');
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
    // Strict mode lives in user settings — keep it in sync alongside the list
    try {
      const me = await apiRequest('/auth/me');
      strictMode = !!me.user?.settings?.strictMode;
      await chrome.storage.local.set({ strictMode });
    } catch (e) {
      console.warn('[DistractFree] Could not refresh settings:', e.message);
    }

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
 * Returns true if the URL is an internal browser/extension page or our own dashboard.
 */
function isInternalUrl(url) {
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('edge://') ||
    url.startsWith('brave://')
  ) {
    return true;
  }

  // Skip our own dashboard (handles both dev and prod)
  try {
    const parsed = new URL(url);
    const dashboardParsed = new URL(DASHBOARD_ORIGIN);
    if (parsed.hostname === dashboardParsed.hostname) return true;
    // The production site and API, including www
    if (parsed.hostname === 'distractfree.site' || parsed.hostname.endsWith('.distractfree.site')) return true;
    // Also skip localhost during development
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return true;
  } catch {
    // ignore parse errors
  }

  return false;
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

  // Skip internal pages and our own dashboard
  if (isInternalUrl(url)) return;

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
      strict: strictMode ? '1' : '0',
    });

    chrome.tabs.update(details.tabId, {
      url: `${blockPageUrl}?${params.toString()}`,
    });

    // Log every blocked attempt (linked to the session when one is running)
    logBrowsingEvent(url, true, false);
    countBlockedAttempt(details.tabId, url);
  }
});

// Also check when tab URL changes (handles redirects, SPA navigations)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await loadPromise;

  if (changeInfo.url && changeInfo.url.startsWith('http')) {
    // Don't re-block if already on block page
    if (changeInfo.url.includes('block.html')) return;
    if (isInternalUrl(changeInfo.url)) return;

    if (isBlocked(changeInfo.url)) {
      const siteInfo = getBlockedSiteInfo(changeInfo.url);
      console.log('[DistractFree] BLOCKING (tab update):', changeInfo.url);

      const blockPageUrl = chrome.runtime.getURL('block.html');
      const params = new URLSearchParams({
        url: changeInfo.url,
        site: siteInfo?.displayName || extractHostname(changeInfo.url),
        siteId: siteInfo?.id || '',
        remaining: activeSession ? getRemainingTime() : 'always',
        strict: strictMode ? '1' : '0',
      });

      chrome.tabs.update(tabId, {
        url: `${blockPageUrl}?${params.toString()}`,
      });
      // In-page navigations (single-page apps) only show up here
      countBlockedAttempt(tabId, changeInfo.url);
    }
  }
});

// ── Tab activity tracking ──────────────────────────

// The page in front of the user and when they got there. Kept in session
// storage: the MV3 service worker sleeps after ~30s idle, which wiped the
// in-memory copy and silently dropped most visits.
let trackedPage = null; // { url, start }
const trackedPageLoaded = chrome.storage.session
  .get('trackedPage')
  .then((d) => { trackedPage = d.trackedPage || null; })
  .catch(() => {});

/**
 * Move the visit tracker to `url` (null = nothing in front, e.g. the browser
 * lost focus). The time spent on the previous site is logged when it was
 * during a session. Staying on the same site (SPA routes, page reloads, a
 * second tab of it) continues the same visit.
 */
async function trackPage(url) {
  await trackedPageLoaded;
  const next = url && /^https?:/i.test(url) ? url : null;
  if (trackedPage && next && extractHostname(trackedPage.url) === extractHostname(next)) return;

  const now = Date.now();
  if (trackedPage && activeSession) {
    // Time before the session started doesn't count
    const start = Math.max(trackedPage.start, activeSession.startTime || 0);
    const duration = Math.round((now - start) / 1000);
    if (duration > 2) logBrowsingEvent(trackedPage.url, false, false, duration);
  }
  trackedPage = next ? { url: next, start: now } : null;
  chrome.storage.session.set({ trackedPage }).catch(() => {});
}

// Navigating within the active tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    chrome.windows.getLastFocused().then((win) => {
      if (win.id === tab.windowId && win.focused) trackPage(changeInfo.url);
    }).catch(() => {});
  }
});

// Switching windows, or leaving the browser altogether
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return trackPage(null);
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    trackPage(tab?.url || null);
  } catch {
    trackPage(null);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await loadPromise;
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const activeTabUrl = tab.url || '';
    trackPage(activeTabUrl);

    // Live-state tracking
    if (activeSession) {
      bumpTelemetry('tabSwitches');
      // Check against configured distraction domains
      const hostname = extractHostname(activeTabUrl);
      if (DISTRACTION_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
        bumpTelemetry('interruptions');
      }
    }
  } catch {
    trackPage(null);
  }
});

// ── Browsing log ───────────────────────────────────

async function logBrowsingEvent(url, wasBlocked = false, wasUnlocked = false, duration = 0) {
  if (!authToken) return;
  // Regular page-time events are only tracked during sessions; blocked and
  // unlocked visits are always recorded so analytics see all distraction activity.
  if (!activeSession && !wasBlocked && !wasUnlocked) return;

  // Browser pages, the block page and DistractFree itself aren't sites you visited
  if (!/^https?:/i.test(url) || isInternalUrl(url)) return;
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
        sessionId: activeSession ? activeSession.sessionId : null,
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
      // Timezone lets the server compute hour-of-day features in local time
      body: JSON.stringify({ plannedDuration, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });

    const serverTime = data.serverTime ? new Date(data.serverTime).getTime() : Date.now();
    const elapsedSecs = Math.max(0, Math.floor((serverTime - new Date(data.session.startTime).getTime()) / 1000));

    activeSession = {
      sessionId: data.session._id,
      startTime: Date.now() - (elapsedSecs * 1000),
      plannedDuration,
      blockedSites: selectedSiteIds || data.session.blockedSitesUsed,
    };

    await chrome.storage.local.set({ activeSession });
    temporarilyUnlocked.clear();

    // Live-state tracking reset & start
    await resetTelemetry(activeSession.sessionId);
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
          // The website started this session: count and report its activity here too
          await resetTelemetry(activeSession.sessionId);
          startLiveSync();
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

// Drop the local session state (timer, alarms, telemetry sync)
async function clearLocalSession() {
  // Log the visit in progress while it still belongs to the session
  if (activeSession) {
    const current = trackedPage?.url || null;
    await trackPage(null);
    await trackPage(current);
  }
  activeSession = null;
  temporarilyUnlocked.clear();
  await chrome.storage.local.remove(['activeSession', 'sessionTelemetry']);
  sessionTelemetry = { ...EMPTY_TELEMETRY };
  stopSessionTimer();
  stopLiveSync();
}

/**
 * Keep the extension in step with the server: if the session was ended
 * elsewhere (e.g. cancelled on the website) clear it here, and adopt a
 * session that was started elsewhere.
 *
 * GET /session/active also starts a scheduled session that is due, so this
 * minute-by-minute check is what starts scheduled sessions when only the
 * extension is running.
 */
async function reconcileSession() {
  try {
    const data = await apiRequest('/session/active');
    const serverSession = data.session;
    if (!serverSession) {
      if (activeSession) {
        console.log('[DistractFree] Session ended elsewhere — clearing local state');
        await clearLocalSession();
      }
      return;
    }
    if (!activeSession || activeSession.sessionId !== serverSession._id) {
      const serverTime = data.serverTime ? new Date(data.serverTime).getTime() : Date.now();
      const elapsedSecs = Math.max(0, Math.floor((serverTime - new Date(serverSession.startTime).getTime()) / 1000));
      activeSession = {
        sessionId: serverSession._id,
        startTime: Date.now() - elapsedSecs * 1000,
        plannedDuration: serverSession.plannedDuration,
        blockedSites: serverSession.blockedSitesUsed || [],
        title: data.schedule?.title || null,
      };
      await chrome.storage.local.set({ activeSession });
      await resetTelemetry(activeSession.sessionId);
      startSessionTimer();
      startLiveSync();
      // Blocked sites are enforced at all times; refresh the list for this session
      await syncBlockedSites();

      if (serverSession.scheduledSessionId) {
        chrome.notifications?.create(`scheduledStart-${serverSession._id}`, {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: `Focus session started: ${data.schedule?.title || 'Scheduled session'}`,
          message: `${serverSession.plannedDuration} minutes${data.schedule?.subject ? ` · ${data.schedule.subject}` : ''}. Blocked sites stay blocked — good luck!`,
        });
      }
    }
  } catch (err) {
    console.warn('[DistractFree] Session reconcile failed:', err.message);
  }
}

async function endFocusSession(cancelled = false) {
  if (!activeSession) return { success: true, alreadyEnded: true };

  try {
    const data = await apiRequest('/session/end', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: activeSession.sessionId,
        cancelled,
      }),
    });

    await clearLocalSession();
    return { success: true, session: data.session };
  } catch (err) {
    // The server already ended it (e.g. cancelled on the website) — just clear locally
    if (/no active session/i.test(err.message)) {
      await clearLocalSession();
      return { success: true, alreadyEnded: true };
    }
    console.error('[DistractFree] Failed to end session:', err.message);
    return { success: false, message: err.message };
  }
}

// ── Timer & ML Telemetry ──────────────────────────

function startLiveSync() {
  if (liveSyncInterval) clearInterval(liveSyncInterval);
  // Every 10 s while the worker is awake; the minute alarm covers the rest
  pushTelemetry();
  liveSyncInterval = setInterval(pushTelemetry, 10000);
}

function stopLiveSync() {
  if (liveSyncInterval) clearInterval(liveSyncInterval);
  liveSyncInterval = null;
}

function startSessionTimer() {
  if (!activeSession) return;

  // Fire when the session's planned time is up — measured from its start, so a
  // session adopted mid-way (or a restarted service worker) still ends on time.
  // Use chrome.alarms for MV3 service worker persistence
  const endsAt = activeSession.startTime + activeSession.plannedDuration * 60000;
  chrome.alarms.create('sessionEnd', {
    when: Math.max(Date.now() + 1000, endsAt),
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
  if (alarm.name === SYNC_ALARM) {
    if (authToken) {
      await syncBlockedSites();
      await reconcileSession();
      // setInterval stops while the worker sleeps; this alarm wakes it every minute
      if (activeSession) await pushTelemetry();
    }
    return;
  }
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
  if (strictMode) {
    return { success: false, message: 'Strict Mode is enabled. Blocked sites cannot be unlocked with coins.' };
  }
  try {
    const data = await apiRequest('/websites/unlock', {
      method: 'POST',
      body: JSON.stringify({ websiteId }),
    });

    // Temporarily allow the URL for 2 minutes
    const hostname = extractHostname(websiteUrl) || websiteUrl;
    temporarilyUnlocked.set(hostname, Date.now() + 2 * 60 * 1000);
    logBrowsingEvent(websiteUrl, false, true);

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
      strictMode = false;
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

    // The website already ended the session on the server — only clear local state
    SESSION_ENDED_EXTERNALLY: async () => {
      await clearLocalSession();
      sendResponse({ success: true });
    },

    RECONCILE_SESSION: async () => {
      if (authToken) await reconcileSession();
      sendResponse({ success: true });
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
        blockedSites: blockedSites,
        strictMode,
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

    SET_API_BASE: async () => {
      // Allow popup to configure the API base URL (e.g., for self-hosted deployments)
      if (message.apiBase) {
        API_BASE = message.apiBase;
        DASHBOARD_ORIGIN = message.dashboardOrigin || DEFAULT_DASHBOARD_ORIGIN;
        await chrome.storage.local.set({
          apiBase: API_BASE,
          dashboardOrigin: DASHBOARD_ORIGIN,
        });
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, message: 'apiBase is required' });
      }
    },
  };

  if (handlers[message.type]) {
    loadPromise.then(() => handlers[message.type]());
    return true; // keep message channel open for async response
  }
});
