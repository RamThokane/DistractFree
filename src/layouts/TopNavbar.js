import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useCoins } from '../context/CoinContext';
import { getGreeting } from '../utils/helpers';
import {
  HiOutlineHome,
  HiOutlineClock,
  HiOutlineCurrencyDollar,
  HiOutlineLightBulb,
  HiOutlineTrophy,
  HiOutlineCog6Tooth,
  HiOutlineArrowRightOnRectangle,
  HiOutlineBars3,
  HiOutlineXMark,
  HiOutlineBell,
  HiOutlineFire,
} from 'react-icons/hi2';

const navItems = [
  { to: '/dashboard', icon: HiOutlineHome, label: 'Dashboard' },
  { to: '/dashboard/focus', icon: HiOutlineClock, label: 'Focus Session' },
  { to: '/dashboard/coins', icon: HiOutlineCurrencyDollar, label: 'Coins' },
  { to: '/dashboard/insights', icon: HiOutlineLightBulb, label: 'AI Insights' },
  { to: '/dashboard/leaderboard', icon: HiOutlineTrophy, label: 'Leaderboard' },
  { to: '/dashboard/settings', icon: HiOutlineCog6Tooth, label: 'Settings' },
];

const TopNavbar = () => {
  const { user, logout } = useAuth();
  const { balance } = useCoins();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* ── Desktop Top Navigation ── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled 
            ? 'bg-[#0F1115]/80 backdrop-blur-xl border-b border-white/[0.06] shadow-lg shadow-black/20' 
            : 'bg-transparent border-b border-transparent'
        }`}
        style={{ height: 64 }}
        role="banner"
      >
        <div className="relative max-w-[1280px] mx-auto h-full px-6 flex items-center justify-between">
          {/* Left — Logo + Brand */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm" style={{background:'linear-gradient(135deg, #5C6BC0, #7E8CF6)'}}>
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="text-white font-semibold text-base tracking-tight hidden sm:block">
              DistractFree
            </span>
          </div>

          {/* Center — Navigation Pills */}
          <nav
            className={`hidden md:flex items-center gap-1 px-2 py-1.5 rounded-full transition-all duration-300 ${
              scrolled ? 'bg-white/[0.03]' : ''
            }`}
            role="navigation"
            aria-label="Main navigation"
          >
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/dashboard'}
                className={({ isActive }) =>
                  `relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isActive
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`
                }
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {({ isActive }) => (
                  <>
                    <span className="relative z-10">{label}</span>
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 bg-white/[0.08] rounded-full shadow-sm"
                        layoutId="activeNavPill"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                        style={{ zIndex: 0 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right — Status + Profile */}
          <div className="flex items-center gap-2">
            {/* Streak Badge */}
            <div className="hidden sm:flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 py-1.5">
              <HiOutlineFire className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-orange-400 text-xs font-semibold">{user?.streak || 0}</span>
            </div>

            {/* Coins Badge */}
            <div className="hidden sm:flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5">
              <span className="text-sm">🪙</span>
              <span className="text-amber-400 text-xs font-semibold">{balance}</span>
            </div>

            {/* Notification Bell */}
            <button
              className="relative p-2 rounded-xl hover:bg-white/[0.06] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Notifications"
            >
              <HiOutlineBell className="w-[18px] h-[18px] text-gray-400" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
            </button>

            {/* Profile Avatar */}
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center cursor-pointer hover:bg-indigo-500/30 transition-colors duration-200">
              <span className="text-indigo-300 text-xs font-semibold">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              aria-label="Logout"
            >
              <HiOutlineArrowRightOnRectangle className="w-4 h-4" />
            </button>

            {/* Mobile Hamburger */}
            <button
              className="md:hidden p-2 rounded-xl hover:bg-white/[0.06] transition-colors text-gray-400"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <HiOutlineBars3 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="md:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer Panel */}
            <motion.div
              className="md:hidden fixed right-0 top-0 bottom-0 w-72 z-[70] bg-[#14171C] border-l border-white/[0.06] shadow-2xl"
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:'linear-gradient(135deg, #5C6BC0, #7E8CF6)'}}>
                    <span className="text-white font-bold text-sm">D</span>
                  </div>
                  <span className="text-white font-semibold text-sm">DistractFree</span>
                </div>
                <button
                  className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors text-gray-400"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                >
                  <HiOutlineXMark className="w-5 h-5" />
                </button>
              </div>

              {/* User Info */}
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <p className="text-xs text-gray-500 mb-0.5">{getGreeting()}</p>
                <p className="text-sm font-semibold text-white">{user?.name || 'User'}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1 text-xs">
                    <HiOutlineFire className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-orange-400 font-medium">{user?.streak || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span>🪙</span>
                    <span className="text-amber-400 font-medium">{balance}</span>
                  </div>
                </div>
              </div>

              {/* Nav Links */}
              <nav className="px-3 py-3 space-y-0.5" aria-label="Mobile navigation">
                {navItems.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/dashboard'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
                      }`
                    }
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </nav>

              {/* Logout */}
              <div className="absolute bottom-0 left-0 right-0 px-3 py-4 border-t border-white/[0.06]">
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 w-full"
                >
                  <HiOutlineArrowRightOnRectangle className="w-[18px] h-[18px]" />
                  <span>Logout</span>
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
