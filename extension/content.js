/**
 * DistractFree — Content Script
 * ==============================
 *
 * Injected into every page at document_start.
 * Checks if the current URL is blocked and communicates with the
 * background service worker.
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

  // Check with the background worker if this URL should be blocked
  chrome.runtime.sendMessage(
    { type: 'CHECK_URL', url: window.location.href },
    (response) => {
      if (chrome.runtime.lastError) return;

      if (response && response.blocked) {
        // The background.js webNavigation handler will redirect,
        // but as a failsafe, we also block content rendering here
        document.documentElement.innerHTML = '';
        document.title = 'DistractFree — Site Blocked';
      }
    }
  );

  // ── Track time spent on page ───────────────────
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

    // Use sendMessage (navigator.sendBeacon not available for extension APIs)
    chrome.runtime.sendMessage({
      type: 'PAGE_TIME',
      url: window.location.href,
      duration,
    });
  });
})();
