import api from './api';

/* ── Auth ── */
export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
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
  getDashboard: () => api.get('/session/dashboard'),
  getLeaderboard: () => api.get('/session/leaderboard'),
};

/* ── Coins ── */
export const coinService = {
  getBalance: () => api.get('/coins/balance'),
  getHistory: (params) => api.get('/coins/history', { params }),
  getSummary: () => api.get('/coins/summary'),
  unlock: (data) => api.post('/coins/unlock', data),
};

/* ── AI Insights ── */
export const insightService = {
  predict: () => api.get('/insights/predict'),
  getAnalytics: (params) => api.get('/insights/analytics', { params }),
  downloadWeeklyReport: () => api.get('/insights/weekly-report', { responseType: 'blob' }),
};
