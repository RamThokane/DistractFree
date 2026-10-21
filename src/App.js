import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { CoinProvider } from './context/CoinContext';
import { ToastProvider } from './components/ui';
import ProtectedRoute, { GuestRoute } from './components/ProtectedRoute';
import RouteTitle from './components/RouteTitle';
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
import CalendarPage from './pages/CalendarPage';
import CoachPage from './pages/CoachPage';
import WeeklyReportPage from './pages/WeeklyReportPage';
import StyleguidePage from './pages/StyleguidePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import LegalPage from './pages/LegalPage';
import ContactPage from './pages/ContactPage';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || (() => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[DistractFree] REACT_APP_GOOGLE_CLIENT_ID is not set. Google Sign-In will not work.');
  }
  return '';
})();

function App() {
  return (
    <ThemeProvider>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <AuthProvider>
      <CoinProvider>
      <ToastProvider>
        <MotionConfig reducedMotion="user">
        <Router>
          <RouteTitle />
          <AnimatePresence mode="wait">
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<GuestRoute><LandingPage /></GuestRoute>} />
              <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
              <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
              <Route path="/styleguide" element={<StyleguidePage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/privacy" element={<LegalPage kind="privacy" />} />
              <Route path="/terms" element={<LegalPage kind="terms" />} />
              <Route path="/contact" element={<ContactPage />} />

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
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="coins" element={<CoinsPage />} />
                <Route path="insights" element={<InsightsPage />} />
                <Route path="coach" element={<CoachPage />} />
                <Route path="weekly-report" element={<WeeklyReportPage />} />
                <Route path="heatmap" element={<ProductivityHeatmapPage />} />
                <Route path="leaderboard" element={<LeaderboardPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </Router>
        </MotionConfig>
      </ToastProvider>
      </CoinProvider>
    </AuthProvider>
    </GoogleOAuthProvider>
    </ThemeProvider>
  );
}

export default App;
