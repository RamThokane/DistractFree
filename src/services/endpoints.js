import api from './api';

/* ── Auth ── */
export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
};

/* ── Sessions ── */
export const sessionService = {
  getSessions: () => api.get('/sessions'),
  createSession: (data) => api.post('/sessions', data),
  getStats: () => api.get('/sessions/stats'),
};

/* ── Coins ── */
export const coinService = {
  getBalance: () => api.get('/coins'),
  unlock: (data) => api.post('/coins/unlock', data),
  getTransactions: () => api.get('/coins/transactions'),
};

/* ── AI Insights ── */
export const insightService = {
  getInsights: () => api.get('/insights'),
  getPatterns: () => api.get('/insights/patterns'),
};

/* ── Leaderboard ── */
export const leaderboardService = {
  getLeaderboard: () => api.get('/leaderboard'),
};
