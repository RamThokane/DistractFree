/**
 * DistractFree — Block Page Logic (v2)
 * =====================================
 * Handles: Timer polling, Strict Mode enforcement,
 *          Unlock with coins, Rotating motivational quotes.
 *
 * Strict mode during a focus session: one free 2-minute pass per site, then
 * a ₹49 unlock (donated to charity) until the session ends, paid on the website.
 */

try {
  // ── URL Params ──────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const siteName = params.get('site') || 'Unknown Website';
  const siteId = params.get('siteId') || '';
  const siteUrl = params.get('url') || '';
  const domain = params.get('domain') || siteName;

  document.getElementById('blocked-site').textContent = siteName;

  // ── DOM References ──────────────────────────────
  const timerRow = document.getElementById('timer-row');
  const timeDisplay = document.getElementById('remaining-time');
  const unlockBtn = document.getElementById('unlock-btn');
  const strictModeMsg = document.getElementById('strict-mode-msg');
  const quoteEl = document.getElementById('quote-text');
  const actionsEl = document.getElementById('actions');
  const confirmEl = document.getElementById('unlock-confirm');
  const confirmYes = document.getElementById('unlock-confirm-yes');
  const confirmNo = document.getElementById('unlock-cancel');
  const confirmTitle = document.getElementById('confirm-title');
  const confirmText = document.getElementById('confirm-text');
  const strictText = document.getElementById('strict-mode-text');
  const passBtn = document.getElementById('pass-btn');
  const payBtn = document.getElementById('pay-btn');
  const STRICT_TEXT = "Strict mode is on. Blocked sites can't be unlocked with coins.";
  const COIN_CONFIRM = { title: confirmTitle.innerHTML, text: confirmText.textContent, yes: confirmYes.textContent };

  // Message the service worker; resolves undefined if it can't answer
  // (reading lastError keeps Chrome from reporting it as an error)
  const ask = (message) => new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) return resolve(undefined);
        resolve(response);
      });
    } catch {
      resolve(undefined); // extension reloaded
    }
  });

  // ── State ───────────────────────────────────────
  let isStrictMode = params.get('strict') === '1';
  let hasActiveSession = false;
  let confirming = false; // the confirm step is open
  let confirmAction = 'coins'; // what it confirms: 'coins' | 'pass' | 'pay'
  let focus = null; // strict mode in a session: { focusStrict, passUsed, passActive, paid, price, unlockPageUrl }
  let busy = false; // a pass or payment is starting

  // ── Motivational Quotes ─────────────────────────
  const quotes = [
    "Discipline is choosing what you want most over what you want now.",
    "Small focus sessions create big results.",
    "Your future self will thank you.",
    "Stay focused. The distraction can wait.",
    "Consistency beats motivation.",
    "Focus is a superpower in a distracted world.",
    "Every minute focused is progress earned.",
    "You are training your attention, not restricting yourself.",
    "Deep work creates deep results.",
    "Control your attention before the internet controls it.",
    "The cost of distraction is greater than the cost of discipline.",
    "What you focus on expands.",
    "Progress, not perfection.",
    "You don't need motivation. You need discipline.",
    "Protect your attention like you protect your money.",
  ];

  let currentQuoteIndex = 0;

  function rotateQuote() {
    if (!quoteEl) return;

    // Fade out
    quoteEl.classList.add('fade-out');

    setTimeout(() => {
      // Advance to next quote
      currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
      quoteEl.textContent = `"${quotes[currentQuoteIndex]}"`;

      // Reset classes — start from below
      quoteEl.classList.remove('fade-out');
      quoteEl.classList.add('fade-in');

      // Force reflow so the browser registers the starting state
      void quoteEl.offsetWidth;

      // Fade in
      quoteEl.classList.remove('fade-in');
    }, 500); // matches CSS transition duration
  }

  // Start with a random quote so it's different every load
  currentQuoteIndex = Math.floor(Math.random() * quotes.length);
  if (quoteEl) {
    quoteEl.textContent = `"${quotes[currentQuoteIndex]}"`;
  }

  // Rotate every 4 seconds
  setInterval(rotateQuote, 4000);

  // ── UI State Manager ────────────────────────────
  const updateUI = () => {
    // Strict mode in a focus session: free pass first, then ₹49
    if (focus && focus.focusStrict && isStrictMode) {
      unlockBtn.style.display = 'none';
      if (strictModeMsg) strictModeMsg.style.display = 'flex';
      if (busy || confirming) return;
      passBtn.style.display = focus.passUsed ? 'none' : '';
      payBtn.style.display = focus.passUsed && !focus.paid ? '' : 'none';
      payBtn.textContent = `Unlock for ₹${focus.price} · until session ends`;
      if (strictText) {
        strictText.textContent = focus.passUsed
          ? `Strict mode is on until your session ends. You've used your free pass for ${domain}.`
          : `Strict mode is on. You have one free 2-minute pass for ${domain} this session.`;
      }
      return;
    }
    passBtn.style.display = 'none';
    payBtn.style.display = 'none';
    if (strictText) strictText.textContent = STRICT_TEXT;

    // Strict Mode disables coin unlocks at all times, not only during sessions
    if (isStrictMode) {
      // Hide unlock button, show strict mode banner
      unlockBtn.style.display = 'none';
      if (strictModeMsg) strictModeMsg.style.display = 'flex';
      closeConfirm();
    } else if (confirming) {
      // Leave the confirm step alone while it's open
      if (strictModeMsg) strictModeMsg.style.display = 'none';
    } else {
      // Show unlock button, hide strict mode banner
      unlockBtn.style.display = '';
      if (strictModeMsg) strictModeMsg.style.display = 'none';

      // Don't re-enable if currently processing
      if (unlockBtn.textContent.indexOf('Unlocking') === -1) {
        unlockBtn.disabled = false;
        unlockBtn.textContent = 'Unlock for 5 coins · 2 min';
        unlockBtn.style.opacity = '1';
        unlockBtn.style.cursor = 'pointer';
      }
    }
  };

  // ── Fetch User Settings (Strict Mode) ───────────
  const checkUser = async () => {
    try {
      const response = await ask({ type: 'GET_USER' });
      if (response && response.user && response.user.settings) {
        isStrictMode = !!response.user.settings.strictMode;
        updateUI();
      }
    } catch (e) {
      console.log('[Block] Failed to fetch user settings:', e);
    }
  };
  checkUser();

  // ── Poll Session Status Every Second ────────────
  const updateStatus = async () => {
    try {
      const response = await ask({ type: 'GET_STATUS' });

      const timerLabel = document.getElementById('timer-label');
      const subtitle = document.getElementById('subtitle');
      if (response && typeof response.strictMode === 'boolean') isStrictMode = response.strictMode;
      if (response && response.activeSession) {
        timerRow.style.display = 'flex';
        if (timerLabel) timerLabel.textContent = 'Session time left';
        timeDisplay.textContent = response.activeSession.remainingTime;
        if (subtitle) subtitle.textContent = 'This site is paused during your focus session.';
        hasActiveSession = true;
      } else {
        timerRow.style.display = 'flex';
        if (timerLabel) timerLabel.textContent = 'Status';
        timeDisplay.textContent = 'Always blocked';
        if (subtitle) subtitle.textContent = 'This site is on your block list.';
        hasActiveSession = false;
      }
      updateUI();
    } catch (e) {
      console.log('[Block] Status poll error:', e);
    }
  };

  updateStatus();
  setInterval(updateStatus, 1000);

  // ── Strict-mode pass / paid unlock state (asks the server) ──
  const refreshFocus = async () => {
    const response = await ask({ type: 'GET_FOCUS_UNLOCK', domain });
    if (!response) return;
    focus = response;
    // Opened meanwhile (pass started in another tab, or the ₹49 payment went through)
    if (focus.focusStrict && (focus.paid || focus.passActive) && siteUrl && !busy) {
      window.location.href = siteUrl;
      return;
    }
    updateUI();
  };
  refreshFocus();
  setInterval(refreshFocus, 15000);

  // ── Unlock: confirm first, then spend ───────────
  function openConfirm(action = 'coins') {
    confirmAction = action;
    if (action === 'pass') {
      confirmTitle.textContent = `Use your free pass for ${domain}?`;
      confirmText.textContent = "This is your only free pass for this site this session. You get 2 minutes, then it's paused again.";
      confirmYes.textContent = 'Open for 2 min';
    } else if (action === 'pay') {
      confirmTitle.textContent = `Unlock ${domain} for ₹${focus?.price || 49}?`;
      confirmText.textContent = 'Your payment is donated to charity. The site stays open until this focus session ends. No refunds.';
      confirmYes.textContent = 'Continue to payment';
    } else {
      confirmTitle.innerHTML = COIN_CONFIRM.title;
      confirmText.textContent = COIN_CONFIRM.text;
      confirmYes.textContent = COIN_CONFIRM.yes;
    }
    confirming = true;
    if (actionsEl) actionsEl.style.display = 'none';
    if (confirmEl) confirmEl.hidden = false;
    if (confirmYes) confirmYes.focus();
  }
  function closeConfirm() {
    confirming = false;
    if (confirmEl) confirmEl.hidden = true;
    if (actionsEl) actionsEl.style.display = '';
  }
  unlockBtn.addEventListener('click', () => openConfirm('coins'));
  passBtn.addEventListener('click', () => openConfirm('pass'));
  payBtn.addEventListener('click', () => openConfirm('pay'));
  if (confirmNo) confirmNo.addEventListener('click', () => { closeConfirm(); unlockBtn.focus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && confirming) closeConfirm(); });

  // The one free pass: the service worker re-blocks the site when it runs out
  async function useFreePass() {
    busy = true;
    passBtn.disabled = true;
    passBtn.textContent = 'Opening…';
    const response = await ask({ type: 'START_GRACE_PASS', domain, url: siteUrl });
    if (response && response.success) {
      passBtn.textContent = 'Opened · 2 min';
      passBtn.classList.add('btn-success');
      setTimeout(() => { window.location.href = siteUrl; }, 600);
      return;
    }
    passBtn.textContent = (response && response.message) || 'Couldn’t start the pass';
    setTimeout(() => {
      busy = false;
      passBtn.disabled = false;
      passBtn.textContent = 'Use free pass · 2 min';
      refreshFocus();
    }, 3000);
  }

  // ₹49 is paid on the website (Cashfree can't run inside the extension)
  function goToPayment() {
    busy = true;
    payBtn.disabled = true;
    payBtn.textContent = 'Opening payment…';
    const target = new URL(focus?.unlockPageUrl || 'https://distractfree.site/dashboard/unlock');
    target.searchParams.set('domain', domain);
    if (siteUrl) target.searchParams.set('url', siteUrl);
    window.location.href = target.toString();
  }

  if (confirmYes) confirmYes.addEventListener('click', async () => {
    closeConfirm();
    if (confirmAction === 'pass') return useFreePass();
    if (confirmAction === 'pay') return goToPayment();
    unlockBtn.disabled = true;
    unlockBtn.textContent = 'Unlocking…';

    try {
      const response = await ask({ type: 'UNLOCK_WEBSITE', websiteId: siteId, websiteUrl: siteUrl });

      if (response && response.success) {
        unlockBtn.textContent = 'Unlocked! Redirecting…';
        unlockBtn.classList.add('btn-success');
        setTimeout(() => {
          window.location.href = siteUrl;
        }, 800);
      } else {
        const errorMsg = response?.message || 'Unlock Failed';
        unlockBtn.textContent = errorMsg;

        // If backend rejected due to strict mode, force lock the UI
        if (errorMsg.includes('Strict Mode')) {
          isStrictMode = true;
        }

        setTimeout(() => {
          updateUI();
        }, 3000);
      }
    } catch (e) {
      unlockBtn.textContent = 'Error occurred';
      setTimeout(() => {
        updateUI();
      }, 3000);
    }
  });

  // ── Go Back Button ──────────────────────────────
  document.getElementById('go-back-btn').addEventListener('click', () => {
    window.location.href = 'https://www.google.com';
  });

} catch (err) {
  console.log('[Block] Page initialization failed:', err);
}
