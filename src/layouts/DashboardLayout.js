import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import TopNavbar from './TopNavbar';
import RewardPopup from '../components/RewardPopup';
import api from '../services/api';
import { announceSessionStarted } from '../utils/schedule';

const SCHEDULE_CHECK_MS = 60 * 1000;

/**
 * Starts scheduled sessions while any dashboard page is open: GET
 * /session/active starts one that is due (the extension does the same every
 * minute, so either is enough). When this check started it, tell the
 * extension and go to the timer.
 */
function useScheduledAutoStart() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await api.get('/session/active');
        if (!cancelled && res.data?.autoStarted && res.data.session) {
          announceSessionStarted(res.data.session);
          navigate('/dashboard/focus');
        }
      } catch {
        // Offline or signed out — the next check tries again
      }
    };
    check();
    const id = setInterval(check, SCHEDULE_CHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [navigate]);
}

const DashboardLayout = () => {
  useScheduledAutoStart();

  return (
    <div className="min-h-screen bg-dash-bg dark:bg-land-dark-bg text-dash-text dark:text-land-dark-text antialiased theme-transition">
      <TopNavbar />
      <RewardPopup />

      {/* Main content area — offset for fixed navbar */}
      <main
        className="pt-[80px] pb-12"
        style={{ minHeight: 'calc(100vh - 64px)' }}
      >
        <div className="max-w-[1280px] mx-auto px-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
