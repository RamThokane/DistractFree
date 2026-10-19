import api from './api';

/* ── Auth ── */
export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me', { params: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
  updateProfile: (data) => api.put('/auth/profile', data),
};

/* ── Sessions ── */
export const sessionService = {
  start: (data) => api.post('/session/start', data),
  end: (data) => api.post('/session/end', data),
  liveUpdate: (data) => api.post('/session/live-update', data),
  getActive: () => api.get('/session/active'),
  getHistory: (params) => api.get('/session/history', { params }),
  getStats: () => api.get('/session/stats'),
  getDashboard: (tz) => api.get('/session/dashboard', { params: { tz } }),
  getLeaderboard: () => api.get('/session/leaderboard'),
};

/* ── Scheduled sessions (calendar) ── */
// id: an occurrence id; scope 'following' = this occurrence and every later one
export const scheduleService = {
  list: (from, to) => api.get('/schedule', { params: { from, to } }),
  next: () => api.get('/schedule/next'),
  create: (data) => api.post('/schedule', data),
  update: (id, data, scope) => api.put(`/schedule/${id}`, data, { params: scope ? { scope } : {} }),
  cancel: (id, scope) => api.delete(`/schedule/${id}`, { params: scope ? { scope } : {} }),
  startNow: (id) => api.post(`/schedule/${id}/start-now`),
};

/* ── AI assistant (Gemini, server-side) ── */
// messages: [{ role: 'user' | 'model', text }] — the recent conversation
export const agentService = {
  status: (tz) => api.get('/agent/status', { params: { tz } }),
  weeklyReport: (week) => api.get('/agent/weekly-report', { params: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone, week } }),
  chat: (messages) => api.post('/agent/chat', { messages, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, { timeout: 90000 }),
};

/* ── Coins ── */
export const coinService = {
  getBalance: () => api.get('/coins/balance', { params: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
  getHistory: (params) => api.get('/coins/history', { params }),
  getSummary: () => api.get('/coins/summary'),
  unlock: (data) => api.post('/coins/unlock', data),
};

/* ── AI Insights ── */
export const insightService = {
  getFull: (tz) => api.get('/insights/full', { params: { tz } }),
  getModel: () => api.get('/insights/model'),
  predict: (params) => api.get('/insights/predict', { params }),
  getAnalytics: (params) => api.get('/insights/analytics', { params }),
  downloadWeeklyReport: () => api.get('/insights/weekly-report', { responseType: 'blob' }),
};
