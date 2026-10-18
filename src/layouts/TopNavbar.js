import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useCoins } from '../context/CoinContext';
import { getGreeting } from '../utils/helpers';
import api from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
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
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuPlay,
  LuChevronsUpDown,
} from 'react-icons/lu';

/* ═══════════════════════════════════════════════════════════════
   App navigation — sidebar (desktop), top bar, and drawer (mobile).
   Same paper / hairline / serif language as the landing page.
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

const EXTRA_TITLES = { '/dashboard/heatmap': 'Focus Heatmap' };
const COLLAPSE_KEY = 'df-sidebar-collapsed';

const pageTitle = (pathname) => {
  const path = pathname.replace(/\/+$/, '') || '/dashboard';
  if (EXTRA_TITLES[path]) return EXTRA_TITLES[path];
  const hit = navItems.find((n) => n.to === path);
  return hit ? hit.label : 'Dashboard';
};

const todayLabel = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

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

const NavList = ({ collapsed = false, onNavigate }) => (
  <nav className="app-nav" aria-label="Main navigation">
    {navItems.map(({ to, icon: Icon, label }) => (
      <NavLink
        key={to}
        to={to}
        end={to === '/dashboard'}
        onClick={onNavigate}
        title={collapsed ? label : undefined}
        aria-label={collapsed ? label : undefined}
        className={({ isActive }) => `app-nav-link ${isActive ? 'is-active' : ''}`}
      >
        <Icon className="app-nav-icon" aria-hidden="true" />
        {!collapsed && <span>{label}</span>}
      </NavLink>
    ))}
  </nav>
);

const CoinPanel = ({ balance, streak, collapsed }) =>
  collapsed ? (
    <Link to="/dashboard/coins" className="app-coin-mini" title={`${balance} Focus Coins`} aria-label={`${balance} Focus Coins`}>
      <LuCoins aria-hidden="true" />
      <span className="df-mono">{balance}</span>
    </Link>
  ) : (
    <Link to="/dashboard/coins" className="app-coin-panel">
      <span className="df-label">Focus Coins</span>
      <span className="app-coin-value df-mono">{balance}</span>
      <span className="app-coin-streak">
        <LuFlame aria-hidden="true" />
        <span><span className="df-mono">{streak}</span>-day streak</span>
      </span>
    </Link>
  );

const TopNavbar = () => {
  const { user, logout } = useAuth();
  const { balance } = useCoins();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useDismiss(showNotifications, notifRef, () => setShowNotifications(false));
  useDismiss(showProfile, profileRef, () => setShowProfile(false));

  // The main column reads this to leave room for the sidebar
  useEffect(() => {
    document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* private mode */ }
    return () => document.documentElement.classList.remove('sidebar-collapsed');
  }, [collapsed]);

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
  const onFocusPage = pathname.startsWith('/dashboard/focus');

  return (
    <>
      {/* ── Sidebar (≥1024px) ── */}
      <aside className={`app-sidebar ${collapsed ? 'is-collapsed' : ''}`} aria-label="Sidebar">
        <div className="app-sidebar-head">
          <Link to="/dashboard" className="app-brand" aria-label="DistractFree dashboard">
            <img src="/favicon.svg" alt="" className="w-7 h-7 rounded-md" />
            {!collapsed && <span>DistractFree</span>}
          </Link>
          <button
            type="button"
            className="app-icon-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <LuPanelLeftOpen /> : <LuPanelLeftClose />}
          </button>
        </div>

        <NavList collapsed={collapsed} />

        <div className="app-sidebar-foot">
          <CoinPanel balance={balance} streak={streak} collapsed={collapsed} />

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setShowProfile((v) => !v)}
              className={`app-user ${collapsed ? 'is-collapsed' : ''}`}
              aria-label="Account menu"
              aria-expanded={showProfile}
            >
              <span className="app-avatar" aria-hidden="true">{initial}</span>
              {!collapsed && (
                <>
                  <span className="app-user-text">
                    <span className="app-user-name">{user?.name || 'User'}</span>
                    {user?.email && <span className="app-user-email">{user.email}</span>}
                  </span>
                  <LuChevronsUpDown className="app-user-chev" aria-hidden="true" />
                </>
              )}
            </button>

            <AnimatePresence>
              {showProfile && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.15 }}
                  className={`app-popover app-popover--up ${collapsed ? 'app-popover--side' : ''}`}
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
        </div>
      </aside>

      {/* ── Top bar ── */}
      <header className={`app-topbar ${scrolled ? 'is-scrolled' : ''}`} role="banner">
        <div className="app-topbar-inner">
          {/* Mobile: menu + brand */}
          <div className="flex items-center gap-2 lg:hidden">
            <button className="app-icon-btn -ml-2" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <LuMenu />
            </button>
            <Link to="/dashboard" className="app-brand" aria-label="DistractFree dashboard">
              <img src="/favicon.svg" alt="" className="w-7 h-7 rounded-md" />
            </Link>
          </div>

          {/* Title + date */}
          <div className="app-title-block">
            <span className="df-label hidden sm:block">{todayLabel()}</span>
            <h1 className="app-title">{pageTitle(pathname)}</h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link to="/dashboard/coins" className="app-coin-chip lg:hidden" aria-label={`${balance} Focus Coins`}>
              <LuCoins aria-hidden="true" />
              <span className="df-mono">{balance}</span>
            </Link>

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

            <ThemeToggle />

            {!onFocusPage && (
              <Link to="/dashboard/focus" className="df-btn df-btn--primary df-btn--sm hidden sm:inline-flex">
                <LuPlay aria-hidden="true" />
                Start focus session
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="lg:hidden fixed inset-0 z-[60] bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="app-drawer lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <div className="app-sidebar-head">
                <Link to="/dashboard" className="app-brand">
                  <img src="/favicon.svg" alt="" className="w-7 h-7 rounded-md" />
                  <span>DistractFree</span>
                </Link>
                <button className="app-icon-btn" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                  <LuX />
                </button>
              </div>

              <div className="px-5 pb-4">
                <p className="text-xs text-muted">{getGreeting()}</p>
                <p className="text-sm font-semibold text-text">{user?.name || 'User'}</p>
              </div>

              <NavList onNavigate={() => setMobileOpen(false)} />

              <div className="app-sidebar-foot">
                <CoinPanel balance={balance} streak={streak} />
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
