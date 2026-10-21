import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useCoins } from '../context/CoinContext';
import { getGreeting } from '../utils/helpers';
import api from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import Wordmark from '../components/Wordmark';
import UserAvatar from '../components/UserAvatar';
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
  LuMessageCircle,
  LuNotebookText,
  LuGrid3X3,
  LuPanelLeftClose,
  LuPanelLeftOpen,
} from 'react-icons/lu';

/* ═══════════════════════════════════════════════════════════════
   App navigation — a fixed left sidebar on wide screens (≥1024px), and
   a top bar with a drawer that slides in from the left below that.
   The top bar always holds the status chips and the account menu.
   ═══════════════════════════════════════════════════════════════ */

export const navItems = [
  { to: '/dashboard', icon: LuLayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/focus', icon: LuTimer, label: 'Focus Session' },
  { to: '/dashboard/calendar', icon: LuCalendarDays, label: 'Calendar' },
  { to: '/dashboard/coins', icon: LuCoins, label: 'Coins' },
  { to: '/dashboard/insights', icon: LuSparkles, label: 'AI Insights' },
  { to: '/dashboard/coach', icon: LuMessageCircle, label: 'Focus Coach' },
  { to: '/dashboard/weekly-report', icon: LuNotebookText, label: 'Weekly Report' },
  { to: '/dashboard/heatmap', icon: LuGrid3X3, label: 'Heatmap' },
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

/** The section links, with icons (sidebar and drawer). Collapsed: icons only, names as tooltips. */
const NavLinks = ({ onNavigate, label, collapsed = false }) => (
  <nav className="flex flex-col gap-0.5 p-3" aria-label={label}>
    {navItems.map(({ to, icon: Icon, label: text }) => (
      <NavLink
        key={to}
        to={to}
        end={to === '/dashboard'}
        onClick={onNavigate}
        title={collapsed ? text : undefined}
        aria-label={collapsed ? text : undefined}
        className={({ isActive }) => `app-drawer-link ${isActive ? 'is-active' : ''}`}
      >
        <Icon aria-hidden="true" />
        {!collapsed && <span>{text}</span>}
      </NavLink>
    ))}
  </nav>
);

/** Streak and log out, at the bottom of the sidebar and drawer. */
const NavFooter = ({ streak, onLogout, collapsed = false }) => (
  <div className="mt-auto p-3 border-t border-line flex flex-col gap-2">
    {collapsed ? (
      <div className="flex items-center justify-center gap-1 py-2 text-sm" title={`${streak}-day streak`}>
        <LuFlame className="text-amber" aria-hidden="true" />
        <span className="df-mono text-text">{streak}</span>
        <span className="sr-only">day streak</span>
      </div>
    ) : (
      <div className="flex items-center justify-between px-3 py-2 text-sm">
        <span className="text-muted flex items-center gap-1.5"><LuFlame className="text-amber" aria-hidden="true" />Streak</span>
        <span className="df-mono text-text">{streak} days</span>
      </div>
    )}
    <button onClick={onLogout} className="app-menu-item app-menu-item--danger rounded-md" title={collapsed ? 'Log out' : undefined} aria-label={collapsed ? 'Log out' : undefined}>
      <LuLogOut aria-hidden="true" />
      {!collapsed && 'Log out'}
    </button>
  </div>
);

const COLLAPSE_KEY = 'df-sidebar-collapsed';

/** Sidebar collapsed to an icon rail, remembered per browser. Sets html.sidebar-collapsed for the layout widths. */
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // storage unavailable — it just won't be remembered
    }
    return () => document.documentElement.classList.remove('sidebar-collapsed');
  }, [collapsed]);
  return [collapsed, setCollapsed];
}

const TopNavbar = () => {
  const { user, logout } = useAuth();
  const { balance } = useCoins();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();
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

  const streak = user?.currentStreak || 0;

  return (
    <>
      {/* ── Sidebar (≥1024px) ── */}
      <aside className={`app-sidebar ${collapsed ? 'is-collapsed' : ''}`} aria-label="Sidebar">
        <div className="app-sidebar-brand">
          {!collapsed && (
            <Link to="/dashboard" className="app-brand" aria-label="DistractFree dashboard">
              <img src="/favicon.svg" alt="" className="w-7 h-7 rounded-md" />
              <Wordmark className="df-wordmark--logo" />
            </Link>
          )}
          <button
            className="app-icon-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <LuPanelLeftOpen /> : <LuPanelLeftClose />}
          </button>
        </div>
        <NavLinks label="Main navigation" collapsed={collapsed} />
        <NavFooter streak={streak} onLogout={handleLogout} collapsed={collapsed} />
      </aside>

      <header className={`app-topbar ${scrolled ? 'is-scrolled' : ''}`} role="banner">
        <div className="app-topbar-inner">
          {/* Left — menu button and logo (on wide screens both live in the sidebar) */}
          <div className="flex items-center gap-1 app-topbar-brand">
            <button className="app-icon-btn app-menu-toggle -ml-2" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <LuMenu />
            </button>
            <Link to="/dashboard" className="app-brand shrink-0" aria-label="DistractFree dashboard">
              <img src="/favicon.svg" alt="" className="w-7 h-7 rounded-md" />
              <Wordmark className="df-wordmark--logo hidden sm:inline" />
            </Link>
          </div>

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
                <UserAvatar user={user} />
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
                    <div className="app-popover-head flex items-center gap-3">
                      <UserAvatar user={user} size={40} className="flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text truncate">{user?.name || 'User'}</p>
                        {user?.email && <p className="text-xs text-muted truncate mt-0.5">{user.email}</p>}
                      </div>
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

          </div>
        </div>
      </header>

      {/* ── Drawer (<1024px), slides in from the left ── */}
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
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
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

              <NavLinks label="Mobile navigation" onNavigate={() => setMobileOpen(false)} />
              <NavFooter streak={streak} onLogout={() => { setMobileOpen(false); handleLogout(); }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default TopNavbar;
