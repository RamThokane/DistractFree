/**
 * DistractFree — Content Script
 * ==============================
 *
 * Injected into every page at document_start.
 * 
 * Two responsibilities:
 *  1. Check if the current URL is blocked during a focus session
 *  2. On the DistractFree website (distractfree.site, or localhost:3000 in
 *     development), watch for auth changes and sync them to chrome.storage
 */

(function () {
  'use strict';

  // Don't run on extension pages
  if (
    window.location.protocol === 'chrome-extension:' ||
    window.location.protocol === 'chrome:' ||
    window.location.protocol === 'about:'
  ) {
    return;
  }

  // After the extension is reloaded or updated, scripts already running in open
  // tabs lose their connection to it and every chrome.* call throws
  // "Extension context invalidated". These helpers go quiet instead.
  const timers = [];
  const alive = () => {
    try { return !!chrome.runtime?.id; } catch { return false; }
  };
  const stopIfDead = () => {
    if (alive()) return false;
    timers.forEach(clearInterval);
    return true;
  };
  function send(message, callback) {
    if (stopIfDead()) return;
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) return; // worker restarting; the next check catches up
        if (callback) callback(response);
      });
    } catch { /* extension reloaded */ }
  }
  function store(method, arg, callback) {
    if (stopIfDead()) return;
    try {
      chrome.storage.local[method](arg, () => {
        if (chrome.runtime.lastError) return;
        if (callback) callback();
      });
    } catch { /* extension reloaded */ }
  }

  // ────────────────────────────────────────────────
  // 1. URL Blocking Check
  // ────────────────────────────────────────────────
  send(
    { type: 'CHECK_URL', url: window.location.href },
    (response) => {
      if (response && response.blocked) {
        // The background.js webNavigation handler will redirect,
        // but as a failsafe, we also block content rendering here
        document.documentElement.innerHTML = '';
        document.title = 'DistractFree — Site Blocked';
      } else if (response && response.unlockExpiry) {
        showUnlockTimer(response.unlockExpiry, response.unlockKind);
      }
    }
  );

  // kind: 'coins' | 'pass' (strict-mode free pass) | 'paid' (₹49, until the session ends)
  function showUnlockTimer(expiryTime, kind) {
    const label = kind === 'pass' ? 'Free pass' : kind === 'paid' ? 'Unlocked for this session' : 'Unlocked';
    if (document.getElementById('df-unlock-timer')) return;

    const container = document.createElement('div');
    container.id = 'df-unlock-timer';
    // DistractFree look: ink chip, mono numbers (literal values — page CSS can't see our tokens)
    Object.assign(container.style, {
      position: 'fixed',
      top: '12px',
      right: '12px',
      background: '#1C1B19',
      color: '#F4F0E8',
      padding: '8px 12px',
      borderRadius: '8px',
      border: '1px solid rgba(244,240,232,0.14)',
      zIndex: '2147483647', // Max z-index
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: '13px',
      fontWeight: '500',
      letterSpacing: '0.01em',
      boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
    });
    container.style.pointerEvents = 'none'; // Don't block clicks
    
    // Make sure body exists
    if (document.body) {
      document.body.appendChild(container);
    } else {
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(container));
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.round((expiryTime - Date.now()) / 1000));
      if (remaining <= 0) {
        container.innerText = 'Locking...';
        clearInterval(interval);
        setTimeout(() => window.location.reload(), 1000); // Reload so background blocks it
      } else {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        container.innerText = `${label} · ${m}:${s.toString().padStart(2, '0')} left`;
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
  }

  // ────────────────────────────────────────────────
  // 2. Dashboard Auth Sync (the DistractFree website only)
  // ────────────────────────────────────────────────
  const DASHBOARD_HOSTS = ['distractfree.site', 'www.distractfree.site'];
  const isDashboard =
    DASHBOARD_HOSTS.includes(window.location.hostname) ||
    (window.location.hostname === 'localhost' && window.location.port === '3000');

  // ── Theme sync: copy the website's light/dark choice into extension storage ──
  const isDistractFreeSite = isDashboard;
  if (isDistractFreeSite) {
    // Lets the website know the extension is installed (it tracks tab switches for the live state)
    document.documentElement.setAttribute('data-distractfree-extension', '1');

    let lastTheme = null;
    const syncTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      if ((theme === 'light' || theme === 'dark') && theme !== lastTheme) {
        lastTheme = theme;
        store('set', { theme });
      }
    };
    syncTheme();
    new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  if (isDashboard) {
    console.log('[DistractFree] Content script running on dashboard — monitoring auth state');

    // Check immediately when page loads
    setTimeout(() => {
      syncTokenToExtension();
    }, 1000);

    // Watch for localStorage changes (cross-tab or same-tab)
    window.addEventListener('storage', (event) => {
      if (event.key === 'df_token') {
        console.log('[DistractFree] Dashboard token changed');
        syncTokenToExtension();
      }
    });

    // Also poll periodically in case the user just logged in
    // (the 'storage' event doesn't fire for same-tab writes)
    let lastKnownToken = localStorage.getItem('df_token');
    timers.push(setInterval(() => {
      const currentToken = localStorage.getItem('df_token');
      if (currentToken !== lastKnownToken) {
        lastKnownToken = currentToken;
        console.log('[DistractFree] Dashboard token changed (poll detected)');
        syncTokenToExtension();
      }
    }, 2000));
  }

  function syncTokenToExtension() {
    const token = localStorage.getItem('df_token');

    if (token) {
      // Store the dashboard token into chrome.storage.local
      store('set', { authToken: token }, () => {
        console.log('[DistractFree] Dashboard token synced to extension storage');

        // Notify the background service worker
        // Signing in also syncs the blocked sites
        send({ type: 'LOGIN', token: token }, () => {
          console.log('[DistractFree] Background notified of dashboard login');
        });
      });
    } else {
      // User logged out on dashboard — clear extension auth too
      store('remove', ['authToken', 'userName', 'userEmail'], () => {
        console.log('[DistractFree] Dashboard logout synced to extension');
        send({ type: 'LOGOUT' });
      });
    }
  }

  // ────────────────────────────────────────────────
  // 2.b Dashboard Session Sync (the DistractFree website only)
  // ────────────────────────────────────────────────
  if (isDashboard) {
    // Watch for CustomEvents directly from the React App (more reliable than localstorage)
    window.addEventListener('DF_SESSION_START', (e) => {
      console.log('[DistractFree] Content Script caught DF_SESSION_START event:', e.detail);
      syncSessionAction({ action: 'start', duration: e.detail.duration });
    });

    window.addEventListener('DF_SESSION_END', () => {
      console.log('[DistractFree] Content Script caught DF_SESSION_END event');
      syncSessionAction({ action: 'end' });
    });

    // Blocked sites or strict mode changed on the website — re-sync immediately
    window.addEventListener('DF_SETTINGS_CHANGED', () => {
      send({ type: 'SYNC_BLOCKED_SITES' });
    });

    // A ₹49 strict-mode unlock was paid — pick it up now
    window.addEventListener('DF_UNLOCKS_CHANGED', () => {
      send({ type: 'SYNC_FOCUS_UNLOCKS' }, () => {
        window.dispatchEvent(new CustomEvent('DF_UNLOCKS_SYNCED'));
      });
    });

    // Keep localStorage watcher as a fallback
    window.addEventListener('storage', (event) => {
      if (event.key === 'df_session_action' && event.newValue) {
        try {
          const actionData = JSON.parse(event.newValue);
          syncSessionAction(actionData);
        } catch (e) {
          /* not ours, or half-written */
        }
      }
    });

    let lastKnownAction = localStorage.getItem('df_session_action');
    timers.push(setInterval(() => {
      const currentAction = localStorage.getItem('df_session_action');
      if (currentAction && currentAction !== lastKnownAction) {
        lastKnownAction = currentAction;
        try {
          const actionData = JSON.parse(currentAction);
          syncSessionAction(actionData);
        } catch (e) {
          /* not ours, or half-written */
        }
      }
    }, 2000));
  }

  function syncSessionAction(actionData) {
    if (actionData.action === 'start') {
      console.log('[DistractFree] Starting session from dashboard:', actionData.duration);
      send({
        type: 'START_SESSION',
        plannedDuration: actionData.duration,
        selectedSites: null // uses default/all
      });
    } else if (actionData.action === 'end') {
      // The dashboard has already ended the session on the server (completed or
      // cancelled) — the extension only needs to drop its local timer.
      console.log('[DistractFree] Session ended on dashboard');
      send({ type: 'SESSION_ENDED_EXTERNALLY' });
    }
  }

  // Time on each site is measured by the service worker (it sees tab and
  // window focus changes), so nothing is reported from here.
})();
