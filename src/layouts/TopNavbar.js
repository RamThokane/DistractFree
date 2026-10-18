import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useCoins } from '../context/CoinContext';
import { getGreeting } from '../utils/helpers';
import api from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import Wordmark from '../components/Wordmark';
import {
  LuLayoutDashboard,
  LuTimer,
  LuCalendarDays,
  LuCoins,
  LuSparkles,
  LuTrophy,
  LuSettings,
  LuLogOut,
  LuMenu,
  LuX,
  LuBell,
  LuFlame,
} from 'react-icons/lu';

/* ═══════════════════════════════════════════════════════════════
   App navigation — a flat horizontal bar (same as the landing nav)
   with a drawer on smaller screens.
   ═══════════════════════════════════════════════════════════════ */

export const navItems = [
  { to: '/dashboard', icon: LuLayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/focus', icon: LuTimer, label: 'Focus Session' },
  { to: '/dashboard/calendar', icon: LuCalendarDays, label: 'Calendar' },
  { to: '/dashboard/coins', icon: LuCoins, label: 'Coins' },
  { to: '/dashboard/insights', icon: LuSparkles, label: 'AI Insights' },
  { to: '/dashboard/leaderboard', icon: LuTrophy, label: 'Leaderboard' },
  { to: '/dashboard/settings', icon: LuSettings, label: 'Settings' },
];

/* Close a popover on outside click or Escape */
function useDismiss(open, ref, close) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, ref, close]);
}

const TopNavbar = () => {
  const { user, logout } = useAuth();
  const { balance } = useCoins();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useDismiss(showNotifications, notifRef, () => setShowNotifications(false));
  useDismiss(showProfile, profileRef, () => setShowProfile(false));

  const fetchNotifications = async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await api.get(`/notifications?tz=${encodeURIComponent(tz)}`);
      if (res.data.success) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close the drawer when the route changes
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const initial = user?.name?.charAt(0)?.toUpperCase() || 'U';
  const streak = user?.currentStreak || 0;

  return (
    <>
      <header className={`app-topbar ${scrolled ? 'is-scrolled' : ''}`} role="banner">
        <div className="app-topbar-inner">
          {/* Left — logo */}
          <Link to="/dashboard" className="app-brand shrink-0" aria-label="DistractFree dashboard">
            <img src="/favicon.svg" alt="" className="w-7 h-7 rounded-md" />
            <Wordmark className="df-wordmark--logo hidden sm:inline" />
          </Link>

          {/* Center — section links (≥1280px) */}
          <nav className="app-hnav" aria-label="Main navigation">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/dashboard'}
                className={({ isActive }) => `app-hnav-link ${isActive ? 'is-active' : ''}`}
              >
                {({ isActive }) => (
                  <>
                    <span>{label}</span>
                    {isActive && (
                      <motion.span
                        className="app-hnav-rule"
                        layoutId="appNavRule"
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right — status + account */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <span className="app-streak-chip hidden sm:inline-flex" title={`${streak}-day streak`}>
              <LuFlame aria-hidden="true" />
              <span className="df-mono">{streak}</span>
              <span className="sr-only">day streak</span>
            </span>
            <Link to="/dashboard/coins" className="app-coin-chip" aria-label={`${balance} Focus Coins`} title="Focus Coins">
              <LuCoins aria-hidden="true" />
              <span className="df-mono">{balance}</span>
            </Link>

            <ThemeToggle />

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                className="app-icon-btn relative"
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                aria-expanded={showNotifications}
              >
                <LuBell />
                {unreadCount > 0 && (
                  <span className="app-badge-dot df-mono" aria-hidden="true">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    className="app-popover app-popover--down w-[min(20rem,calc(100vw-2rem))]"
                  >
                    <div className="app-popover-head flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-text">Notifications</h2>
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAllAsRead} className="df-link text-xs">
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif._id}
                            onClick={() => !notif.read && handleMarkAsRead(notif._id)}
                            className={`app-notif ${!notif.read ? 'is-unread' : ''}`}
                          >
                            <div className="flex justify-between items-start gap-3">
                              <div className="min-w-0">
                                <p className={`text-sm font-medium ${!notif.read ? 'text-text' : 'text-text-2'}`}>
                                  {notif.title}
                                </p>
                                <p className="text-xs text-muted mt-1 line-clamp-2">
                                  {notif.message}
                                </p>
                                <span className="df-mono text-[11px] text-muted mt-1.5 block">
                                  {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {!notif.read && (
                                <button
                                  onClick={() => handleMarkAsRead(notif._id)}
                                  className="app-unread-dot"
                                  title="Mark as read"
                                  aria-label="Mark as read"
                                />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Avatar + menu */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setShowProfile((v) => !v)}
                className="app-avatar-btn"
                aria-label="Account menu"
                aria-expanded={showProfile}
              >
                <span className="app-avatar" aria-hidden="true">{initial}</span>
              </button>

              <AnimatePresence>
                {showProfile && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    className="app-popover app-popover--down"
                  >
                    <div className="app-popover-head">
                      <p className="text-sm font-semibold text-text truncate">{user?.name || 'User'}</p>
                      {user?.email && <p className="text-xs text-muted truncate mt-0.5">{user.email}</p>}
                    </div>
                    <button onClick={() => { setShowProfile(false); navigate('/dashboard/settings'); }} className="app-menu-item">
                      <LuSettings aria-hidden="true" />
                      Settings
                    </button>
                    <button onClick={() => { setShowProfile(false); handleLogout(); }} className="app-menu-item app-menu-item--danger">
                      <LuLogOut aria-hidden="true" />
                      Log out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Hamburger (<1280px) */}
            <button className="app-icon-btn app-menu-toggle -mr-2" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <LuMenu />
            </button>
          </div>
        </div>
      </header>

      {/* ── Drawer (<1280px) ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[60] bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="app-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <div className="flex items-center justify-between h-16 px-5 border-b border-line">
                <div>
                  <p className="text-xs text-muted">{getGreeting()}</p>
                  <p className="text-sm font-semibold text-text">{user?.name || 'User'}</p>
                </div>
                <button className="app-icon-btn -mr-2" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                  <LuX />
                </button>
              </div>

              <nav className="flex flex-col gap-0.5 p-3" aria-label="Mobile navigation">
                {navItems.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/dashboard'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => `app-drawer-link ${isActive ? 'is-active' : ''}`}
                  >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </nav>

              <div className="mt-auto p-3 border-t border-line flex flex-col gap-2">
                <div className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-muted flex items-center gap-1.5"><LuFlame className="text-amber" aria-hidden="true" />Streak</span>
                  <span className="df-mono text-text">{streak} days</span>
                </div>
                <button
                  onClick={() => { setMobileOpen(false); handleLogout(); }}
                  className="app-menu-item app-menu-item--danger rounded-md"
                >
                  <LuLogOut aria-hidden="true" />
                  Log out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default TopNavbar;
