import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import TopNavbar from './TopNavbar';
import '../styles/app.css';
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
    <div className="app-shell df-grain">
      <TopNavbar />
      <RewardPopup />

      <main id="main" className="app-main">
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
