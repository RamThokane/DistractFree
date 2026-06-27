import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { CoinProvider } from './context/CoinContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardHome from './pages/DashboardHome';
import FocusSession from './pages/FocusSession';
import CoinsPage from './pages/CoinsPage';
import InsightsPage from './pages/InsightsPage';
import ProductivityHeatmapPage from './pages/ProductivityHeatmapPage';
import LeaderboardPage from './pages/LeaderboardPage';
import SettingsPage from './pages/SettingsPage';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || (() => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[DistractFree] REACT_APP_GOOGLE_CLIENT_ID is not set. Google Sign-In will not work.');
  }
  return '';
})();

function App() {
  React.useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'dark');
    root.classList.add('dark');
    localStorage.setItem('df_theme', 'dark');
  }, []);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <AuthProvider>
      <CoinProvider>
        <Router>
          <AnimatePresence mode="wait">
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected dashboard routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardHome />} />
                <Route path="focus" element={<FocusSession />} />
                <Route path="coins" element={<CoinsPage />} />
                <Route path="insights" element={<InsightsPage />} />
                <Route path="heatmap" element={<ProductivityHeatmapPage />} />
                <Route path="leaderboard" element={<LeaderboardPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </Router>
      </CoinProvider>
    </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
