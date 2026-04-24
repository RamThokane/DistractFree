/**
 * DistractFree — Content Script
 * ==============================
 *
 * Injected into every page at document_start.
 * 
 * Two responsibilities:
 *  1. Check if the current URL is blocked during a focus session
 *  2. On localhost:3000 (dashboard), watch for auth changes and
 *     sync them to the extension's chrome.storage
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

  // ────────────────────────────────────────────────
  // 1. URL Blocking Check
  // ────────────────────────────────────────────────
  chrome.runtime.sendMessage(
    { type: 'CHECK_URL', url: window.location.href },
    (response) => {
      if (chrome.runtime.lastError) return;

      if (response && response.blocked) {
        // The background.js webNavigation handler will redirect,
        // but as a failsafe, we also block content rendering here
        document.documentElement.innerHTML = '';
        document.title = 'DistractFree — Site Blocked';
      } else if (response && response.unlockExpiry) {
        showUnlockTimer(response.unlockExpiry);
      }
    }
  );

  function showUnlockTimer(expiryTime) {
    if (document.getElementById('df-unlock-timer')) return;

    const container = document.createElement('div');
    container.id = 'df-unlock-timer';
    container.style.position = 'fixed';
    container.style.top = '10px';
    container.style.right = '10px';
    container.style.backgroundColor = 'rgba(0,0,0,0.85)';
    container.style.color = '#fff';
    container.style.padding = '8px 12px';
    container.style.borderRadius = '6px';
    container.style.zIndex = '2147483647'; // Max z-index
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    container.style.fontSize = '14px';
    container.style.fontWeight = '600';
    container.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
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
        container.innerText = `⏳ Unlocked: ${m}:${s.toString().padStart(2, '0')}`;
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
  }

  // ────────────────────────────────────────────────
  // 2. Dashboard Auth Sync (only on localhost:3000)
  // ────────────────────────────────────────────────
  const isDashboard =
    window.location.hostname === 'localhost' &&
    window.location.port === '3000';

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
    setInterval(() => {
      const currentToken = localStorage.getItem('df_token');
      if (currentToken !== lastKnownToken) {
        lastKnownToken = currentToken;
        console.log('[DistractFree] Dashboard token changed (poll detected)');
        syncTokenToExtension();
      }
    }, 2000);
  }

  function syncTokenToExtension() {
    const token = localStorage.getItem('df_token');

    if (token) {
      // Store the dashboard token into chrome.storage.local
      chrome.storage.local.set({ authToken: token }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[DistractFree] Failed to sync token:', chrome.runtime.lastError.message);
          return;
        }
        console.log('[DistractFree] Dashboard token synced to extension storage');

        // Notify the background service worker
        chrome.runtime.sendMessage({ type: 'LOGIN', token: token }, (response) => {
          if (chrome.runtime.lastError) return;
          console.log('[DistractFree] Background notified of dashboard login');
        });

        // Also sync blocked sites
        chrome.runtime.sendMessage({ type: 'SYNC_BLOCKED_SITES' }, () => {
          if (chrome.runtime.lastError) return;
        });
      });
    } else {
      // User logged out on dashboard — clear extension auth too
      chrome.storage.local.remove(['authToken', 'userName', 'userEmail'], () => {
        if (chrome.runtime.lastError) return;
        console.log('[DistractFree] Dashboard logout synced to extension');
        chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
          if (chrome.runtime.lastError) return;
        });
      });
    }
  }

  // ────────────────────────────────────────────────
  // 2.b Dashboard Session Sync (only on localhost:3000)
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

    // Keep localStorage watcher as a fallback
    window.addEventListener('storage', (event) => {
      if (event.key === 'df_session_action' && event.newValue) {
        try {
          const actionData = JSON.parse(event.newValue);
          syncSessionAction(actionData);
        } catch (e) {
          console.error('[DistractFree] Error parsing session action', e);
        }
      }
    });

    let lastKnownAction = localStorage.getItem('df_session_action');
    setInterval(() => {
      const currentAction = localStorage.getItem('df_session_action');
      if (currentAction && currentAction !== lastKnownAction) {
        lastKnownAction = currentAction;
        try {
          const actionData = JSON.parse(currentAction);
          syncSessionAction(actionData);
        } catch (e) {
          console.error('[DistractFree] Error parsing session action from poll', e);
        }
      }
    }, 2000);
  }

  function syncSessionAction(actionData) {
    if (actionData.action === 'start') {
      console.log('[DistractFree] Starting session from dashboard:', actionData.duration);
      chrome.runtime.sendMessage({ 
        type: 'START_SESSION', 
        plannedDuration: actionData.duration,
        selectedSites: null // uses default/all
      }, () => {
        if (chrome.runtime.lastError) return;
      });
    } else if (actionData.action === 'end') {
      console.log('[DistractFree] Ending session from dashboard');
      chrome.runtime.sendMessage({ 
        type: 'END_SESSION', 
        cancelled: false 
      }, () => {
        if (chrome.runtime.lastError) return;
      });
    }
  }

  // ────────────────────────────────────────────────
  // 3. Track time spent on page
  // ────────────────────────────────────────────────
  let startTime = Date.now();
  let isVisible = true;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isVisible = false;
    } else {
      isVisible = true;
      startTime = Date.now();
    }
  });

  // Report time spent when navigating away
  window.addEventListener('beforeunload', () => {
    if (!isVisible) return;

    const duration = Math.round((Date.now() - startTime) / 1000);
    if (duration < 2) return;

    chrome.runtime.sendMessage({
      type: 'PAGE_TIME',
      url: window.location.href,
      duration,
    });
  });
})();
