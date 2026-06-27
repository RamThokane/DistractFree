/**
 * DistractFree — Popup Script
 * ============================
 * 
 * Auth flow:
 *  1. Check chrome.storage for saved token → validate → show dashboard
 *  2. Check if dashboard tab has a token → sync → show dashboard  
 *  3. Otherwise show login form
 *
 * For Google OAuth users: use "Sync from Dashboard" button
 * For email/password users: use the login form
 */

// ── Configuration ──────────────────────────────────
// These match the defaults in background.js.
// To use a custom backend, update DEFAULT_API_BASE.
const DEFAULT_API_BASE = 'https://distractfree-backend.vercel.app/api';
const DEFAULT_DASHBOARD_URL = 'https://distractfree.vercel.app';

let API_BASE = DEFAULT_API_BASE;
let DASHBOARD_URL = DEFAULT_DASHBOARD_URL;

// ── DOM Elements ───────────────────────────────────
const $ = (id) => document.getElementById(id);

const authSection = $('auth-section');
const dashboardSection = $('dashboard-section');
const timerSection = $('timer-section');
const startSection = $('start-section');

const loginEmail = $('login-email');
const loginPassword = $('login-password');
const loginBtn = $('login-btn');
const loginLink = $('login-link');
const syncDashboardBtn = $('sync-dashboard-btn');
const authError = $('auth-error');

const greetingText = $('greeting-text');
const userName = $('user-name');

const sessionStatus = $('session-status');
const coinBalance = $('coin-balance');
const streakCount = $('streak-count');
const blockedCount = $('blocked-count');
const statusCard = $('status-card');

const timerDisplay = $('timer-display');
const timerProgress = $('timer-progress');
const durationSelect = $('duration-select');
const customDurationContainer = $('custom-duration-container');
const customDurationInput = $('custom-duration-input');
const startSessionBtn = $('start-session-btn');
const endSessionBtn = $('end-session-btn');
const cancelSessionBtn = $('cancel-session-btn');

// Inline confirm UI elements (if they exist in HTML)
const confirmCancelSection = $('confirm-cancel-section');
const confirmCancelYes = $('confirm-cancel-yes');
const confirmCancelNo = $('confirm-cancel-no');

const syncBtn = $('sync-btn');
const dashboardBtn = $('dashboard-btn');
const logoutBtn = $('logout-btn');

// ── State ──────────────────────────────────────────
let timerInterval = null;
let totalSessionSeconds = 0;

// ── Helpers ────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function sendMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Popup] sendMessage error:', chrome.runtime.lastError.message);
          resolve({});
          return;
        }
        resolve(response || {});
      });
    } catch (err) {
      console.warn('[Popup] sendMessage exception:', err);
      resolve({});
    }
  });
}

function showError(msg) {
  if (!authError) return;
  authError.textContent = msg;
  authError.classList.remove('hidden');
  setTimeout(() => authError.classList.add('hidden'), 10000);
}

function hideError() {
  if (authError) authError.classList.add('hidden');
}

function setLoginLoading(loading) {
  const btnText = loginBtn.querySelector('.btn-text');
  const btnLoader = loginBtn.querySelector('.btn-loader');
  loginBtn.disabled = loading;
  if (loginEmail) loginEmail.disabled = loading;
  if (loginPassword) loginPassword.disabled = loading;
  if (loading) {
    if (btnText) btnText.textContent = 'Signing in…';
    if (btnLoader) btnLoader.classList.remove('hidden');
  } else {
    if (btnText) btnText.textContent = 'Sign In';
    if (btnLoader) btnLoader.classList.add('hidden');
  }
}

function updateTimerRing(remaining, total) {
  if (!timerProgress || total <= 0) return;
  const circumference = 2 * Math.PI * 52;
  const progress = remaining / total;
  const offset = circumference * (1 - progress);
  timerProgress.style.strokeDasharray = circumference;
  timerProgress.style.strokeDashoffset = offset;
}

// ── Validate token against the API ─────────────────
async function validateToken(token) {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data.user : null;
  } catch (err) {
    console.warn('[Popup] Token validation error:', err);
    return null;
  }
}

// ── Read token from dashboard tab ──────────────────
async function tryGetDashboardToken() {
  return new Promise((resolve) => {
    try {
      // Query tabs matching the dashboard URL pattern
      const dashboardPattern = `${DASHBOARD_URL}/*`;
      chrome.tabs.query({ url: dashboardPattern }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
          console.log('[Popup] No dashboard tabs found at', dashboardPattern);
          resolve(null);
          return;
        }

        console.log('[Popup] Found dashboard tab:', tabs[0].id);

        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            func: () => localStorage.getItem('df_token'),
          },
          (results) => {
            if (chrome.runtime.lastError) {
              console.warn('[Popup] executeScript error:', chrome.runtime.lastError.message);
              resolve(null);
              return;
            }
            const token = results && results[0] && results[0].result;
            console.log('[Popup] Dashboard token found:', !!token);
            resolve(token || null);
          }
        );
      });
    } catch (err) {
      console.warn('[Popup] tryGetDashboardToken error:', err);
      resolve(null);
    }
  });
}

// ── Complete auth and show dashboard ───────────────
async function authenticateWithToken(token, source) {
  const user = await validateToken(token);
  if (!user) return false;

  console.log(`[Popup] Authenticated via ${source} as ${user.name}`);

  // Save to extension storage
  await chrome.storage.local.set({
    authToken: token,
    userName: user.name,
    userEmail: user.email,
  });

  // Notify background
  await sendMessage({ type: 'LOGIN', token });
  try { await sendMessage({ type: 'SYNC_BLOCKED_SITES' }); } catch (e) { /* ok */ }

  // Show dashboard
  const status = await sendMessage({ type: 'GET_STATUS' });
  showDashboard(status || { isAuthenticated: true, blockedSitesCount: 0 }, user.name);
  return true;
}

// ── Load API base from storage ──────────────────────
async function loadApiConfig() {
  const stored = await chrome.storage.local.get(['apiBase', 'dashboardOrigin']);
  if (stored.apiBase) API_BASE = stored.apiBase;
  if (stored.dashboardOrigin) DASHBOARD_URL = stored.dashboardOrigin;
}

// ══════════════════════════════════════════════════
// INITIALISATION
// ══════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initialising…');

  // Load API config first
  await loadApiConfig();

  // Step 1: Check chrome.storage for existing token
  const stored = await chrome.storage.local.get(['authToken']);
  if (stored.authToken) {
    console.log('[Popup] Step 1: Found stored token');
    const ok = await authenticateWithToken(stored.authToken, 'stored token');
    if (ok) return;
    // Token was invalid — clear it
    await chrome.storage.local.remove(['authToken', 'userName', 'userEmail']);
  }

  // Step 2: Try to get token from dashboard tab
  console.log('[Popup] Step 2: Checking dashboard tab…');
  try {
    const dashToken = await tryGetDashboardToken();
    if (dashToken) {
      const ok = await authenticateWithToken(dashToken, 'dashboard tab');
      if (ok) return;
    }
  } catch (err) {
    console.warn('[Popup] Dashboard token check failed:', err);
  }

  // Step 3: Show login form
  console.log('[Popup] Step 3: Showing login form');
  showAuth();
});

// ══════════════════════════════════════════════════
// LOGIN (email/password)
// ══════════════════════════════════════════════════

if (loginBtn) loginBtn.addEventListener('click', handleLogin);

async function handleLogin() {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    showError('Please enter both email and password.');
    return;
  }

  if (!email.includes('@') || !email.includes('.')) {
    showError('Please enter a valid email address.');
    return;
  }

  setLoginLoading(true);
  hideError();

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      let errorMsg = 'Login failed.';

      if (data.errors && Array.isArray(data.errors)) {
        errorMsg = data.errors.map((e) => e.message || e.msg).join('. ');
      } else if (data.message) {
        errorMsg = data.message;
      }

      // Hint about Google signup
      if (errorMsg.includes('Invalid email or password')) {
        errorMsg += '\n\nSigned up with Google? Use the green "Sync from Dashboard" button below instead.';
      }

      showError(errorMsg);
      setLoginLoading(false);
      return;
    }

    // Success — save and show dashboard
    await chrome.storage.local.set({
      authToken: data.token,
      userName: data.user.name,
      userEmail: data.user.email,
    });

    await sendMessage({ type: 'LOGIN', token: data.token });
    try { await sendMessage({ type: 'SYNC_BLOCKED_SITES' }); } catch (e) { /* ok */ }

    const status = await sendMessage({ type: 'GET_STATUS' });
    showDashboard(
      status || { isAuthenticated: true, blockedSitesCount: 0 },
      data.user.name
    );
  } catch (err) {
    console.error('[Popup] Login error:', err);
    if (err.message && err.message.includes('Failed to fetch')) {
      showError('Cannot connect to server. Please check your internet connection.');
    } else {
      showError('Connection error: ' + (err.message || 'Unknown'));
    }
  } finally {
    setLoginLoading(false);
  }
}

// Enter key support
if (loginPassword) {
  loginPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
}
if (loginEmail) {
  loginEmail.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && loginPassword) loginPassword.focus();
  });
}

// ══════════════════════════════════════════════════
// SYNC FROM DASHBOARD (for Google OAuth users)
// ══════════════════════════════════════════════════

if (syncDashboardBtn) {
  syncDashboardBtn.addEventListener('click', async () => {
    syncDashboardBtn.disabled = true;
    syncDashboardBtn.textContent = '⚡ Checking…';
    hideError();

    try {
      // Method 1: Read from dashboard tab via scripting API
      let token = await tryGetDashboardToken();

      // Method 2: Fallback — check chrome.storage (content.js may have synced it)
      if (!token) {
        const stored = await chrome.storage.local.get(['authToken']);
        token = stored.authToken || null;
      }

      if (token) {
        const ok = await authenticateWithToken(token, 'dashboard sync');
        if (ok) return;
      }

      // No token found
      showError(`No active dashboard session found.\n\n1. Open ${DASHBOARD_URL} in a tab\n2. Sign in on the dashboard\n3. Come back and click this button again`);
    } catch (err) {
      console.error('[Popup] Sync error:', err);
      showError('Sync failed. Make sure the dashboard is open and you are signed in.');
    } finally {
      syncDashboardBtn.disabled = false;
      syncDashboardBtn.textContent = '⚡ Sync from Dashboard';
    }
  });
}

if (loginLink) {
  loginLink.addEventListener('click', () => {
    chrome.tabs.create({ url: `${DASHBOARD_URL}/register` });
  });
}

// ══════════════════════════════════════════════════
// LOGOUT
// ══════════════════════════════════════════════════

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await chrome.storage.local.clear();
    try { await sendMessage({ type: 'LOGOUT' }); } catch (e) { /* ok */ }
    clearTimerInterval();
    showAuth();
  });
}

// ══════════════════════════════════════════════════
// DASHBOARD VIEW
// ══════════════════════════════════════════════════

async function showDashboard(status, name) {
  if (authSection) authSection.classList.add('hidden');
  if (dashboardSection) dashboardSection.classList.remove('hidden');

  if (greetingText) greetingText.textContent = getGreeting();

  // Fetch user data
  try {
    const token = (await chrome.storage.local.get('authToken')).authToken;
    if (token) {
      const user = await validateToken(token);
      if (user) {
        if (userName) userName.textContent = user.name || name || 'User';
        if (coinBalance) coinBalance.textContent = user.focusCoins || 0;
        if (streakCount) streakCount.textContent = user.currentStreak || 0;
      } else {
        if (userName) userName.textContent = name || 'User';
      }
    } else {
      if (userName) userName.textContent = name || 'User';
    }
  } catch (e) {
    if (userName) userName.textContent = name || 'User';
  }

  if (blockedCount) blockedCount.textContent = (status && status.blockedSitesCount) || 0;

  if (status && status.activeSession) {
    showActiveSession(status.activeSession);
  } else {
    showStartSection(status && status.blockedSites ? status.blockedSites : []);
  }
}

function showAuth() {
  if (authSection) authSection.classList.remove('hidden');
  if (dashboardSection) dashboardSection.classList.add('hidden');
  hideError();
  if (loginEmail) loginEmail.value = '';
  if (loginPassword) loginPassword.value = '';
}

function showActiveSession(session) {
  if (startSection) startSection.classList.add('hidden');
  if (timerSection) timerSection.classList.remove('hidden');
  if (sessionStatus) {
    sessionStatus.textContent = 'Focusing';
    sessionStatus.className = 'status-badge active';
  }
  if (statusCard) statusCard.classList.add('active');
  totalSessionSeconds = (session.plannedDuration || 25) * 60;
  updateTimerDisplay(session.remainingTime);
  startTimerInterval();
}

function showStartSection(blockedSites = []) {
  if (startSection) startSection.classList.remove('hidden');
  if (timerSection) timerSection.classList.add('hidden');
  if (sessionStatus) {
    sessionStatus.textContent = 'Idle';
    sessionStatus.className = 'status-badge';
  }
  if (statusCard) statusCard.classList.remove('active');
  clearTimerInterval();

  const listContainer = $('site-selection-list');
  if (listContainer) {
    if (blockedSites.length === 0) {
      listContainer.innerHTML = '<div class="text-xs text-gray-500">No websites to block. Add them in dashboard settings.</div>';
    } else {
      listContainer.innerHTML = blockedSites.map(site => `
        <div class="flex items-center" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 13px;">
          <span style="color: var(--danger); font-size: 10px;">🔴</span>
          <span class="site-value" data-url="${site.url}">${site.displayName || site.url}</span>
        </div>
      `).join('');
    }
  }
}

// ══════════════════════════════════════════════════
// SESSION CONTROLS
// ══════════════════════════════════════════════════

if (durationSelect) {
  durationSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      if (customDurationContainer) customDurationContainer.classList.remove('hidden');
    } else {
      if (customDurationContainer) customDurationContainer.classList.add('hidden');
    }
  });
}

if (startSessionBtn) {
  startSessionBtn.addEventListener('click', async () => {
    let duration;
    if (durationSelect && durationSelect.value === 'custom') {
      duration = parseInt(customDurationInput ? customDurationInput.value : '25');
    } else {
      duration = parseInt(durationSelect ? durationSelect.value : '25');
    }

    if (!duration || duration < 1 || duration > 480) {
      showError('Please enter a valid duration (1-480 minutes)');
      return;
    }

    const siteElements = document.querySelectorAll('.site-value');
    const selectedSites = Array.from(siteElements).map(el => el.getAttribute('data-url'));

    startSessionBtn.disabled = true;
    startSessionBtn.textContent = 'Starting…';

    const result = await sendMessage({ type: 'START_SESSION', plannedDuration: duration, selectedSites: selectedSites });

    startSessionBtn.disabled = false;
    startSessionBtn.textContent = '🎯 Start Focus Session';

    if (result && result.success) {
      const status = await sendMessage({ type: 'GET_STATUS' });
      if (status && status.activeSession) showActiveSession(status.activeSession);
    } else {
      const errorMsg = (result && result.message) || 'Failed to start session. Please check your connection.';
      showError('⚠️ ' + errorMsg);
    }
  });
}

if (endSessionBtn) {
  endSessionBtn.addEventListener('click', async () => {
    endSessionBtn.disabled = true;
    const result = await sendMessage({ type: 'END_SESSION', cancelled: false });
    if (result && result.success) {
      const status = await sendMessage({ type: 'GET_STATUS' });
      showDashboard(status);
    }
    endSessionBtn.disabled = false;
  });
}

if (cancelSessionBtn) {
  cancelSessionBtn.addEventListener('click', () => {
    // Show inline confirm UI if it exists, otherwise use inline text approach
    if (confirmCancelSection) {
      confirmCancelSection.classList.remove('hidden');
      cancelSessionBtn.classList.add('hidden');
    } else {
      // Fallback — set button to confirm state
      cancelSessionBtn.textContent = 'Confirm Cancel? (click again)';
      cancelSessionBtn.dataset.confirming = 'true';
    }
  });
}

// Inline confirm buttons (in HTML)
if (confirmCancelYes) {
  confirmCancelYes.addEventListener('click', async () => {
    if (confirmCancelSection) confirmCancelSection.classList.add('hidden');
    if (cancelSessionBtn) cancelSessionBtn.classList.remove('hidden');
    const result = await sendMessage({ type: 'END_SESSION', cancelled: true });
    if (result && result.success) showStartSection();
  });
}

if (confirmCancelNo) {
  confirmCancelNo.addEventListener('click', () => {
    if (confirmCancelSection) confirmCancelSection.classList.add('hidden');
    if (cancelSessionBtn) cancelSessionBtn.classList.remove('hidden');
    if (cancelSessionBtn) delete cancelSessionBtn.dataset.confirming;
  });
}

// ══════════════════════════════════════════════════
// TIMER
// ══════════════════════════════════════════════════

function startTimerInterval() {
  clearTimerInterval();
  timerInterval = setInterval(async () => {
    const status = await sendMessage({ type: 'GET_STATUS' });
    if (status && status.activeSession) {
      updateTimerDisplay(status.activeSession.remainingTime);
    } else {
      showStartSection();
      clearTimerInterval();
    }
  }, 1000);
}

function clearTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay(time) {
  if (timerDisplay) timerDisplay.textContent = time || '00:00';
  if (time && totalSessionSeconds > 0) {
    const parts = time.split(':');
    const remaining = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    updateTimerRing(remaining, totalSessionSeconds);
  }
}

// ══════════════════════════════════════════════════
// QUICK ACTIONS
// ══════════════════════════════════════════════════

if (syncBtn) {
  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.textContent = '↻ Syncing…';

    // Also try sync from dashboard
    try {
      const dashToken = await tryGetDashboardToken();
      if (dashToken) {
        const stored = await chrome.storage.local.get('authToken');
        if (!stored.authToken || stored.authToken !== dashToken) {
          await authenticateWithToken(dashToken, 'quick sync');
        }
      }
    } catch (e) { /* ok */ }

    const result = await sendMessage({ type: 'SYNC_BLOCKED_SITES' });
    if (blockedCount) blockedCount.textContent = (result && result.count) || 0;

    syncBtn.disabled = false;
    syncBtn.textContent = '↻ Sync';
  });
}

if (dashboardBtn) {
  dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: `${DASHBOARD_URL}/dashboard` });
  });
}
