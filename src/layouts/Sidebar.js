import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  HiOutlineHome,
  HiOutlineClock,
  HiOutlineCurrencyDollar,
  HiOutlineLightBulb,
  HiOutlineCalendarDays,
  HiOutlineTrophy,
  HiOutlineCog6Tooth,
  HiOutlineArrowRightOnRectangle,
  HiOutlineBars3,
  HiOutlineXMark,
} from 'react-icons/hi2';

const navItems = [
  { to: '/dashboard', icon: HiOutlineHome, label: 'Dashboard' },
  { to: '/dashboard/focus', icon: HiOutlineClock, label: 'Focus Session' },
  { to: '/dashboard/coins', icon: HiOutlineCurrencyDollar, label: 'Coins' },
  { to: '/dashboard/insights', icon: HiOutlineLightBulb, label: 'AI Insights' },
  { to: '/dashboard/heatmap', icon: HiOutlineCalendarDays, label: 'Productivity Heatmap' },
  { to: '/dashboard/leaderboard', icon: HiOutlineTrophy, label: 'Leaderboard' },
  { to: '/dashboard/settings', icon: HiOutlineCog6Tooth, label: 'Settings' },
];

const Sidebar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const SidebarContent = ({ onItemClick }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sage flex items-center justify-center">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <span className="text-dash-text font-semibold text-lg tracking-tight">DistractFree</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            onClick={onItemClick}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 ${
                isActive
                  ? 'bg-dash-hover text-dash-text border-l-2 border-dash-accent -ml-px'
                  : 'text-dash-muted hover:text-dash-text hover:bg-dash-hover'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-[18px] h-[18px] ${
                  isActive ? 'text-dash-accent' : 'text-dash-muted group-hover:text-dash-text'
                }`} />
                <span className="text-sm font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-8">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-dash-muted hover:text-red-500 hover:bg-red-50 transition-colors duration-150 w-full"
        >
          <HiOutlineArrowRightOnRectangle className="w-[18px] h-[18px]" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-60 z-40">
        <div className="h-full bg-white border-r border-dash-border overflow-y-auto">
          <SidebarContent onItemClick={() => {}} />
        </div>
      </aside>

      {/* Mobile Toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border border-dash-border shadow-dash-sm"
        onClick={() => setMobileOpen(true)}
      >
        <HiOutlineBars3 className="w-5 h-5 text-dash-text" />
      </button>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="lg:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="lg:hidden fixed left-0 top-0 bottom-0 w-64 z-50 bg-white border-r border-dash-border shadow-lg"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <button
                className="absolute top-5 right-4 p-2 rounded-lg hover:bg-dash-hover transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                <HiOutlineXMark className="w-5 h-5 text-dash-muted" />
              </button>
              <SidebarContent onItemClick={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
