/**
 * DistractFree — Popup Script
 * ============================
 * 
 * Auth flow:
 *  1. Check chrome.storage for saved token → validate → show dashboard
 *  2. Check if dashboard tab (localhost:3000) has a token → sync → show dashboard  
 *  3. Otherwise show login form
 *
 * For Google OAuth users: use "Sync from Dashboard" button
 * For email/password users: use the login form
 */

const API_BASE = 'http://localhost:5000/api';

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
  authError.textContent = msg;
  authError.classList.remove('hidden');
  setTimeout(() => authError.classList.add('hidden'), 10000);
}

function hideError() {
  authError.classList.add('hidden');
}

function setLoginLoading(loading) {
  const btnText = loginBtn.querySelector('.btn-text');
  const btnLoader = loginBtn.querySelector('.btn-loader');
  loginBtn.disabled = loading;
  loginEmail.disabled = loading;
  loginPassword.disabled = loading;
  if (loading) {
    btnText.textContent = 'Signing in…';
    btnLoader.classList.remove('hidden');
  } else {
    btnText.textContent = 'Sign In';
    btnLoader.classList.add('hidden');
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
      chrome.tabs.query({ url: 'http://localhost:3000/*' }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
          console.log('[Popup] No dashboard tabs found');
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

// ══════════════════════════════════════════════════
// INITIALISATION
// ══════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initialising…');

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

loginBtn.addEventListener('click', handleLogin);

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
      // Parse error
      let errorMsg = 'Login failed.';

      if (data.errors && Array.isArray(data.errors)) {
        errorMsg = data.errors.map((e) => e.message || e.msg).join('. ');
      } else if (data.message) {
        errorMsg = data.message;
      }

      // If "Invalid email or password" — hint about Google signup
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
      showError('Cannot connect to server. Is the backend running on port 5000?');
    } else {
      showError('Connection error: ' + (err.message || 'Unknown'));
    }
  } finally {
    setLoginLoading(false);
  }
}

// Enter key support
loginPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});
loginEmail.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginPassword.focus();
});

// ══════════════════════════════════════════════════
// SYNC FROM DASHBOARD (for Google OAuth users)
// ══════════════════════════════════════════════════

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
    showError('No active dashboard session found.\n\n1. Open localhost:3000 in a tab\n2. Sign in on the dashboard\n3. Come back and click this button again');
  } catch (err) {
    console.error('[Popup] Sync error:', err);
    showError('Sync failed. Make sure the dashboard is open and you are signed in.');
  } finally {
    syncDashboardBtn.disabled = false;
    syncDashboardBtn.textContent = '⚡ Sync from Dashboard';
  }
});

loginLink.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000/register' });
});

// ══════════════════════════════════════════════════
// LOGOUT
// ══════════════════════════════════════════════════

logoutBtn.addEventListener('click', async () => {
  await chrome.storage.local.clear();
  try { await sendMessage({ type: 'LOGOUT' }); } catch (e) { /* ok */ }
  clearTimerInterval();
  showAuth();
});

// ══════════════════════════════════════════════════
// DASHBOARD VIEW
// ══════════════════════════════════════════════════

async function showDashboard(status, name) {
  authSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');

  greetingText.textContent = getGreeting();

  // Fetch user data
  try {
    const token = (await chrome.storage.local.get('authToken')).authToken;
    if (token) {
      const user = await validateToken(token);
      if (user) {
        userName.textContent = user.name || name || 'User';
        coinBalance.textContent = user.focusCoins || 0;
        streakCount.textContent = user.currentStreak || 0;
      } else {
        userName.textContent = name || 'User';
      }
    } else {
      userName.textContent = name || 'User';
    }
  } catch (e) {
    userName.textContent = name || 'User';
  }

  blockedCount.textContent = (status && status.blockedSitesCount) || 0;

  if (status && status.activeSession) {
    showActiveSession(status.activeSession);
  } else {
    showStartSection(status.blockedSites || []);
  }
}

function showAuth() {
  authSection.classList.remove('hidden');
  dashboardSection.classList.add('hidden');
  hideError();
  loginEmail.value = '';
  loginPassword.value = '';
}

function showActiveSession(session) {
  startSection.classList.add('hidden');
  timerSection.classList.remove('hidden');
  sessionStatus.textContent = 'Focusing';
  sessionStatus.className = 'status-badge active';
  statusCard.classList.add('active');
  totalSessionSeconds = (session.plannedDuration || 25) * 60;
  updateTimerDisplay(session.remainingTime);
  startTimerInterval();
}

function showStartSection(blockedSites = []) {
  startSection.classList.remove('hidden');
  timerSection.classList.add('hidden');
  sessionStatus.textContent = 'Idle';
  sessionStatus.className = 'status-badge';
  statusCard.classList.remove('active');
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

durationSelect.addEventListener('change', (e) => {
  if (e.target.value === 'custom') {
    customDurationContainer.classList.remove('hidden');
  } else {
    customDurationContainer.classList.add('hidden');
  }
});

startSessionBtn.addEventListener('click', async () => {
  let duration;
  if (durationSelect.value === 'custom') {
    duration = parseInt(customDurationInput.value);
  } else {
    duration = parseInt(durationSelect.value);
  }

  if (!duration || duration < 25 || duration > 180) {
    alert('Please enter a valid duration (25-180 minutes)');
    return;
  }

  const siteElements = document.querySelectorAll('.site-value');
  const selectedSites = Array.from(siteElements).map(el => el.getAttribute('data-url'));

  startSessionBtn.disabled = true;
  startSessionBtn.textContent = 'Starting…';

  console.log('[Popup] Starting session:', duration, 'minutes', 'sites:', selectedSites);
  const result = await sendMessage({ type: 'START_SESSION', plannedDuration: duration, selectedSites: selectedSites });
  console.log('[Popup] Session start result:', result);

  startSessionBtn.disabled = false;
  startSessionBtn.textContent = '🎯 Start Focus Session';

  if (result && result.success) {
    const status = await sendMessage({ type: 'GET_STATUS' });
    if (status && status.activeSession) showActiveSession(status.activeSession);
  } else {
    // Show the error to the user
    const errorMsg = (result && result.message) || 'Failed to start session. Is the backend running?';
    alert('⚠️ ' + errorMsg);
  }
});

endSessionBtn.addEventListener('click', async () => {
  endSessionBtn.disabled = true;
  const result = await sendMessage({ type: 'END_SESSION', cancelled: false });
  if (result && result.success) {
    showStartSection();
    const status = await sendMessage({ type: 'GET_STATUS' });
    showDashboard(status);
  }
  endSessionBtn.disabled = false;
});

cancelSessionBtn.addEventListener('click', async () => {
  if (!confirm('Cancel session? You won\'t earn any coins.')) return;
  const result = await sendMessage({ type: 'END_SESSION', cancelled: true });
  if (result && result.success) showStartSection();
});

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
  timerDisplay.textContent = time || '00:00';
  if (time && totalSessionSeconds > 0) {
    const parts = time.split(':');
    const remaining = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    updateTimerRing(remaining, totalSessionSeconds);
  }
}

// ══════════════════════════════════════════════════
// QUICK ACTIONS
// ══════════════════════════════════════════════════

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
  blockedCount.textContent = (result && result.count) || 0;

  syncBtn.disabled = false;
  syncBtn.textContent = '↻ Sync';
});

dashboardBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
});
