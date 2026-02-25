/* ── Mock data for development before backend is connected ── */

export const mockUser = {
  id: '1',
  name: 'Alex Rivera',
  email: 'alex@distractfree.app',
  avatar: null,
  streak: 12,
  focusCoins: 340,
  joinedAt: '2026-01-10',
};

export const mockDashboardStats = {
  todayFocusMinutes: 145,
  todayGoalMinutes: 240,
  coinsEarnedToday: 45,
  currentStreak: 12,
  aiFocusScore: 78,
  weeklyFocusData: [
    { day: 'Mon', minutes: 180, coins: 36 },
    { day: 'Tue', minutes: 210, coins: 42 },
    { day: 'Wed', minutes: 150, coins: 30 },
    { day: 'Thu', minutes: 240, coins: 48 },
    { day: 'Fri', minutes: 190, coins: 38 },
    { day: 'Sat', minutes: 120, coins: 24 },
    { day: 'Sun', minutes: 145, coins: 29 },
  ],
  distractionTrend: [
    { day: 'Mon', score: 25 },
    { day: 'Tue', score: 18 },
    { day: 'Wed', score: 32 },
    { day: 'Thu', score: 15 },
    { day: 'Fri', score: 22 },
    { day: 'Sat', score: 28 },
    { day: 'Sun', score: 20 },
  ],
  coinsEarnedWeekly: [
    { day: 'Mon', coins: 36 },
    { day: 'Tue', coins: 42 },
    { day: 'Wed', coins: 30 },
    { day: 'Thu', coins: 48 },
    { day: 'Fri', coins: 38 },
    { day: 'Sat', coins: 24 },
    { day: 'Sun', coins: 29 },
  ],
};

export const mockTransactions = [
  { id: 1, type: 'earned', amount: 20, description: 'Focus session completed (25 min)', date: '2026-02-25T10:30:00Z' },
  { id: 2, type: 'earned', amount: 15, description: 'Focus session completed (20 min)', date: '2026-02-25T14:15:00Z' },
  { id: 3, type: 'spent', amount: -10, description: 'Unlocked 5 min break', date: '2026-02-25T15:00:00Z' },
  { id: 4, type: 'earned', amount: 30, description: 'Focus session completed (40 min)', date: '2026-02-24T09:00:00Z' },
  { id: 5, type: 'bonus', amount: 50, description: '7-day streak bonus!', date: '2026-02-24T23:59:00Z' },
  { id: 6, type: 'spent', amount: -25, description: 'Unlocked 15 min break', date: '2026-02-23T16:45:00Z' },
  { id: 7, type: 'earned', amount: 20, description: 'Focus session completed (25 min)', date: '2026-02-23T11:20:00Z' },
  { id: 8, type: 'earned', amount: 40, description: 'Focus session completed (50 min)', date: '2026-02-22T10:00:00Z' },
];

export const mockInsights = {
  focusPattern: {
    bestHour: '9 AM - 11 AM',
    worstHour: '2 PM - 4 PM',
    avgSessionLength: 32,
    optimalSessionLength: 40,
  },
  highRiskHours: [
    { hour: '2 PM', risk: 78 },
    { hour: '3 PM', risk: 85 },
    { hour: '8 PM', risk: 65 },
    { hour: '9 PM', risk: 72 },
  ],
  recommendations: [
    {
      icon: '⏱️',
      title: 'Optimal Session Length',
      text: 'Your distraction risk increases after 45 minutes. Try 40-minute sessions for peak focus.',
    },
    {
      icon: '☕',
      title: 'Strategic Breaks',
      text: 'Taking a 5-minute break every 40 minutes reduces your afternoon distraction rate by 35%.',
    },
    {
      icon: '🎯',
      title: 'Morning Power Hours',
      text: 'Your focus score peaks between 9-11 AM. Schedule deep work during this window.',
    },
    {
      icon: '📱',
      title: 'Social Media Pattern',
      text: 'You check social media most between 2-4 PM. Pre-schedule a short unlock to stay in control.',
    },
  ],
  improvementTrend: [
    { week: 'W1', score: 52 },
    { week: 'W2', score: 58 },
    { week: 'W3', score: 65 },
    { week: 'W4', score: 71 },
    { week: 'W5', score: 78 },
  ],
};

export const mockLeaderboard = [
  { rank: 1, name: 'Maya Chen', weeklyHours: 42.5, coins: 850, isCurrentUser: false },
  { rank: 2, name: 'Liam O\'Brien', weeklyHours: 38.2, coins: 764, isCurrentUser: false },
  { rank: 3, name: 'Priya Sharma', weeklyHours: 36.8, coins: 736, isCurrentUser: false },
  { rank: 4, name: 'Alex Rivera', weeklyHours: 34.1, coins: 682, isCurrentUser: true },
  { rank: 5, name: 'Jordan Kim', weeklyHours: 31.5, coins: 630, isCurrentUser: false },
  { rank: 6, name: 'Emma Davis', weeklyHours: 29.8, coins: 596, isCurrentUser: false },
  { rank: 7, name: 'Noah Patel', weeklyHours: 27.3, coins: 546, isCurrentUser: false },
  { rank: 8, name: 'Sofia Garcia', weeklyHours: 25.1, coins: 502, isCurrentUser: false },
  { rank: 9, name: 'Ethan Wright', weeklyHours: 23.6, coins: 472, isCurrentUser: false },
  { rank: 10, name: 'Aisha Johnson', weeklyHours: 21.9, coins: 438, isCurrentUser: false },
];

export const motivationalQuotes = [
  "The secret of getting ahead is getting started.",
  "Focus on being productive instead of busy.",
  "Small disciplines repeated with consistency lead to great achievements.",
  "Your future self will thank you for the focus you give today.",
  "Discipline is choosing between what you want now and what you want most.",
  "The ability to concentrate and to use time well is everything.",
  "Where focus goes, energy flows.",
  "Don't watch the clock; do what it does — keep going.",
  "It's not about having time, it's about making time.",
  "Starve your distractions, feed your focus.",
];
