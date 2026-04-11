/**
 * DistractFree — Popup Script
 * ============================
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
const authError = $('auth-error');

const sessionStatus = $('session-status');
const coinBalance = $('coin-balance');
const streakCount = $('streak-count');
const blockedCount = $('blocked-count');
const statusCard = $('status-card');

const timerDisplay = $('timer-display');
const durationSelect = $('duration-select');
const startSessionBtn = $('start-session-btn');
const endSessionBtn = $('end-session-btn');
const cancelSessionBtn = $('cancel-session-btn');

const syncBtn = $('sync-btn');
const dashboardBtn = $('dashboard-btn');
const logoutBtn = $('logout-btn');

// ── State ──────────────────────────────────────────
let timerInterval = null;

// ── Initialisation ─────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] Initialising…');

  // First check chrome.storage directly for token
  // (doesn't depend on service worker being alive)
  const stored = await chrome.storage.local.get(['authToken']);

  if (stored.authToken) {
    console.log('[Popup] Found stored token, checking status…');
    try {
      const status = await sendMessage({ type: 'GET_STATUS' });
      if (status && status.isAuthenticated) {
        showDashboard(status);
        return;
      }
    } catch (err) {
      console.warn('[Popup] GET_STATUS failed, trying to wake service worker:', err);
    }

    // Service worker might not be alive — try to re-authenticate it
    try {
      await sendMessage({ type: 'LOGIN', token: stored.authToken });
      const status = await sendMessage({ type: 'GET_STATUS' });
      if (status && status.isAuthenticated) {
        showDashboard(status);
        return;
      }
    } catch (err) {
      console.warn('[Popup] Re-auth failed:', err);
    }
  }

  // Not authenticated — show login
  showAuth();
});

// ── Auth ───────────────────────────────────────────

loginBtn.addEventListener('click', async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value.trim();

  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in…';
  hideError();

  try {
    console.log('[Popup] Attempting login for:', email);

    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    console.log('[Popup] Login response status:', response.status);

    const data = await response.json();
    console.log('[Popup] Login response:', data.success ? 'success' : data.message);

    if (!data.success) {
      showError(data.message || 'Invalid email or password');
      return;
    }

    // Store token in chrome.storage FIRST
    await chrome.storage.local.set({
      authToken: data.token,
      userName: data.user.name,
    });

    // Then notify background service worker
    try {
      await sendMessage({ type: 'LOGIN', token: data.token });
    } catch (e) {
      console.warn('[Popup] Background LOGIN message failed (non-critical):', e);
    }

    // Show dashboard
    const status = await sendMessage({ type: 'GET_STATUS' });
    showDashboard(status || { isAuthenticated: true, blockedSitesCount: 0 });
  } catch (err) {
    console.error('[Popup] Login error:', err);
    showError('Connection failed. Is the backend server running on port 5000?');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
});

loginLink.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000/register' });
});

logoutBtn.addEventListener('click', async () => {
  await chrome.storage.local.clear();
  try {
    await sendMessage({ type: 'LOGOUT' });
  } catch (e) {
    // Service worker may not be active
  }
  clearTimerInterval();
  showAuth();
});

// ── Dashboard ──────────────────────────────────────

async function showDashboard(status) {
  authSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');

  // Fetch user data from backend
  try {
    const token = (await chrome.storage.local.get('authToken')).authToken;
    if (token) {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        coinBalance.textContent = data.user.focusCoins || 0;
        streakCount.textContent = data.user.currentStreak || 0;
      }
    }
  } catch (e) {
    console.warn('[Popup] Failed to fetch user data:', e);
    // Use defaults
  }

  blockedCount.textContent = (status && status.blockedSitesCount) || 0;

  if (status && status.activeSession) {
    showActiveSession(status.activeSession);
  } else {
    showStartSection();
  }
}

function showAuth() {
  authSection.classList.remove('hidden');
  dashboardSection.classList.add('hidden');
  hideError();
  console.log('[Popup] Showing auth form');
}

function showActiveSession(session) {
  startSection.classList.add('hidden');
  timerSection.classList.remove('hidden');
  sessionStatus.textContent = 'Focusing';
  sessionStatus.className = 'status-badge active';
  statusCard.classList.add('active');

  updateTimerDisplay(session.remainingTime);
  startTimerInterval(session);
}

function showStartSection() {
  startSection.classList.remove('hidden');
  timerSection.classList.add('hidden');
  sessionStatus.textContent = 'Idle';
  sessionStatus.className = 'status-badge';
  statusCard.classList.remove('active');
  clearTimerInterval();
}

// ── Session controls ───────────────────────────────

startSessionBtn.addEventListener('click', async () => {
  const duration = parseInt(durationSelect.value);

  startSessionBtn.disabled = true;
  startSessionBtn.textContent = 'Starting…';

  const result = await sendMessage({
    type: 'START_SESSION',
    plannedDuration: duration,
  });

  startSessionBtn.disabled = false;
  startSessionBtn.textContent = '🎯 Start Focus Session';

  if (result && result.success) {
    const status = await sendMessage({ type: 'GET_STATUS' });
    if (status && status.activeSession) {
      showActiveSession(status.activeSession);
    }
  } else {
    showError((result && result.message) || 'Failed to start session');
  }
});

endSessionBtn.addEventListener('click', async () => {
  endSessionBtn.disabled = true;
  const result = await sendMessage({ type: 'END_SESSION', cancelled: false });

  if (result && result.success) {
    showStartSection();
    // Refresh coin balance
    const status = await sendMessage({ type: 'GET_STATUS' });
    showDashboard(status);
  }
  endSessionBtn.disabled = false;
});

cancelSessionBtn.addEventListener('click', async () => {
  if (!confirm('Cancel session? You won\'t earn any coins.')) return;

  const result = await sendMessage({ type: 'END_SESSION', cancelled: true });
  if (result && result.success) {
    showStartSection();
  }
});

// ── Timer ──────────────────────────────────────────

function startTimerInterval(session) {
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
}

// ── Quick actions ──────────────────────────────────

syncBtn.addEventListener('click', async () => {
  syncBtn.disabled = true;
  syncBtn.textContent = 'Syncing…';

  const result = await sendMessage({ type: 'SYNC_BLOCKED_SITES' });
  blockedCount.textContent = (result && result.count) || 0;

  syncBtn.disabled = false;
  syncBtn.textContent = '↻ Sync';
});

dashboardBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
});

// ── Helpers ────────────────────────────────────────

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
  setTimeout(() => authError.classList.add('hidden'), 6000);
}

function hideError() {
  authError.classList.add('hidden');
}
