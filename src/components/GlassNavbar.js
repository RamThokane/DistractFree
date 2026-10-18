import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineBars3, HiOutlineXMark } from 'react-icons/hi2';

/**
 * NavItem — Plain text link; the active one gets a thin underline.
 */
const NavItem = ({ label, path, index, isActive, onClick }) => {
  return (
    <button
      onClick={() => onClick(path)}
      className={`lp-hlink ${isActive ? 'is-active' : ''}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
    >
      <span className="lp-hlink-num" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <span>{label}</span>
      {isActive && (
        <motion.span
          className="lp-hlink-rule"
          layoutId="navActiveRule"
          transition={{ duration: 0.2, ease: 'easeOut' }}
        />
      )}
    </button>
  );
};

/**
 * GlassNavbar — Section links for the landing page bar (flat, no glass).
 */
const GlassNavbar = ({ items = [], activePath = '', onNavigate }) => {
  const [activeItem, setActiveItem] = useState(activePath);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync active pill when parent updates activePath (e.g. scroll tracking).
  React.useEffect(() => {
    setActiveItem(activePath);
  }, [activePath]);

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
        className="hidden md:flex items-center gap-1 lg:gap-2"
        role="tablist"
        aria-label="Page navigation"
      >
        {items.map((item, i) => (
          <NavItem
            key={item.path}
            label={item.label}
            path={item.path}
            index={i}
            isActive={activeItem === item.path}
            onClick={handleClick}
          />
        ))}
      </div>

      <button
        className="md:hidden order-last -mr-2 p-2 rounded-md text-fg-2 hover:text-hi transition-colors"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <HiOutlineBars3 className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="md:hidden fixed inset-0 z-[100] bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="md:hidden fixed top-3 left-3 right-3 z-[110] rounded-lg p-3 border lp-sheet"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-hi font-semibold text-sm">Navigation</span>
                <button
                  className="p-1.5 rounded-md hover:bg-ink/[0.06] transition-colors"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                >
                  <HiOutlineXMark className="w-5 h-5 text-fg-2" />
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
                      w-full text-left px-3 py-3 rounded-md text-sm font-medium transition-colors duration-150
                      ${activeItem === item.path ? 'lp-sheet-active' : 'text-fg-2 hover:bg-ink/[0.05]'}
                    `}
                  >
                    {item.label}
                  </button>
                ))}
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); alert('🚀 Coming soon to the Chrome Web Store!'); setMobileOpen(false); }}
                  className={`
                    w-full flex items-center gap-2 px-3 py-3 rounded-md text-sm font-medium transition-colors duration-150
                    text-fg-2 hover:bg-ink/[0.05]
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
