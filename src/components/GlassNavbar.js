import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineBars3, HiOutlineXMark } from 'react-icons/hi2';

/**
 * NavItem — Individual pill button inside the glass container.
 */
const NavItem = ({ label, path, isActive, onClick }) => {
  return (
    <button
      onClick={() => onClick(path)}
      className={`
        relative px-5 py-2.5 rounded-full text-sm font-medium
        transition-all duration-200 ease-in-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
        ${isActive
          ? 'text-gray-900 dark:text-white'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
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
          className="absolute inset-0 rounded-full"
          layoutId="glassActiveTab"
          style={{
            background: 'rgba(255, 255, 255, 0.6)',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
          }}
          transition={{ type: 'spring', bounce: 0.12, duration: 0.5 }}
        />
      )}
      {/* Hover background */}
      {!isActive && (
        <div
          className="absolute inset-0 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-150"
          style={{ background: 'rgba(255, 255, 255, 0.25)' }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
};

/**
 * GlassNavbar — Floating frosted glass pill navigation.
 *
 * Usage:
 * <GlassNavbar
 *   items={[
 *     { label: "How It Works", path: "#how-it-works" },
 *     { label: "Product", path: "#product" },
 *     { label: "Research", path: "#research" },
 *   ]}
 *   activePath="#product"
 *   onNavigate={(path) => handleNavigation(path)}
 * />
 */
const GlassNavbar = ({ items = [], activePath = '', onNavigate }) => {
  const [activeItem, setActiveItem] = useState(activePath);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleClick = (path) => {
    setActiveItem(path);
    if (onNavigate) {
      onNavigate(path);
    } else {
      // Default: scroll to anchor
      const el = document.querySelector(path);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <>
      {/* ── Desktop Glass Pill ── */}
      <div
        className="hidden md:flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-full"
        style={{
          background: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
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
          />
        ))}
      </div>

      {/* ── Dark Mode Glass Pill Variant ── */}
      {/* This uses CSS .dark parent detection via Tailwind */}

      {/* ── Mobile Hamburger Trigger ── */}
      <button
        className="md:hidden p-2 rounded-xl hover:bg-white/10 transition-colors"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <HiOutlineBars3 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
      </button>

      {/* ── Mobile Menu Overlay ── */}
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
              className="md:hidden fixed top-4 left-4 right-4 z-[110] rounded-2xl p-4"
              style={{
                background: 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12)',
              }}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-900 font-semibold text-sm">Navigation</span>
                <button
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
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
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default GlassNavbar;
