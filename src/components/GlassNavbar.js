import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineBars3, HiOutlineXMark } from 'react-icons/hi2';

/**
 * NavItem — Individual pill button inside the glass container.
 */
const NavItem = ({ label, path, isActive, onClick, isDark }) => {
  return (
    <button
      onClick={() => onClick(path)}
      className={`
        relative px-5 py-2.5 rounded-full text-sm font-medium
        transition-all duration-200 ease-in-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
        ${isActive
          ? isDark ? 'text-white' : 'text-gray-900'
          : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
        }
      `}
      style={{
        WebkitTapHighlightColor: 'transparent',
        letterSpacing: '0.01em',
      }}
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
    >
      {/* Active pill background */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-full shadow-sm"
          style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.7)' }}
          layoutId="glassActiveTab"
          transition={{ type: 'spring', bounce: 0.12, duration: 0.5 }}
        />
      )}
      {/* Hover background */}
      {!isActive && (
        <div
          className="absolute inset-0 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-150"
          style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)' }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
};

/**
 * GlassNavbar — Floating frosted glass pill navigation.
 */
const GlassNavbar = ({ items = [], activePath = '', onNavigate }) => {
  const [activeItem, setActiveItem] = useState(activePath);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync active pill when parent updates activePath (e.g. scroll tracking).
  React.useEffect(() => {
    setActiveItem(activePath);
  }, [activePath]);

  // Initialize from localStorage immediately (same key ThemeToggle uses)
  // so the correct colour is applied on the very first render — no flash.
  const [isDark, setIsDark] = useState(() => {
    try {
      return (
        localStorage.getItem('land-theme') === 'dark' ||
        document.documentElement.classList.contains('dark')
      );
    } catch {
      return false;
    }
  });

  // Keep in sync whenever ThemeToggle toggles the class on <html>.
  React.useEffect(() => {
    const checkDarkMode = () =>
      setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleClick = (path) => {
    setActiveItem(path);
    if (onNavigate) {
      onNavigate(path);
    } else {
      const el = document.querySelector(path);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <>
      <div
        className="hidden md:flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-full backdrop-blur-xl border"
        style={{
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.6)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.4)',
          boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.08)'
        }}
        role="tablist"
        aria-label="Page navigation"
      >
        {items.map((item) => (
          <NavItem
            key={item.path}
            label={item.label}
            path={item.path}
            isActive={activeItem === item.path}
            onClick={handleClick}
            isDark={isDark}
          />
        ))}
      </div>

      <button
        className="md:hidden p-2 rounded-xl transition-colors"
        style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)' }}
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <HiOutlineBars3 className={`w-5 h-5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`} />
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="md:hidden fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="md:hidden fixed top-4 left-4 right-4 z-[110] rounded-2xl p-4 backdrop-blur-2xl border"
              style={{
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.92)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.4)',
                boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.5)' : '0 16px 48px rgba(0,0,0,0.12)'
              }}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold text-sm`}>Navigation</span>
                <button
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                >
                  <HiOutlineXMark className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="space-y-1">
                {items.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => {
                      handleClick(item.path);
                      setMobileOpen(false);
                    }}
                    className={`
                      w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150
                      ${activeItem === item.path
                        ? isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-50 text-blue-600'
                        : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-50'
                      }
                    `}
                  >
                    {item.label}
                  </button>
                ))}
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); alert('🚀 Coming soon to the Chrome Web Store!'); setMobileOpen(false); }}
                  className={`
                    w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150
                    ${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-50'}
                  `}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M21.17 8H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M3.95 6.06L8.54 14.12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M10.88 21.94L15.46 13.88" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Add to Chrome
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default GlassNavbar;
