import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* Virtual resolutions — content is laid out at these sizes and scaled to fit */
export const DESKTOP = { screenW: 960, screenH: 600, winX: 12, winY: 30, winW: 936, winH: 558, chrome: 78 };
export const COMPACT = { winW: 400, winH: 620, chrome: 46 };

/* ── Small icons (stroke, currentColor) ── */
const Icon = ({ d, size = 16, stroke = 1.8, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS = {
  back: 'M19 12H5m6-7l-7 7 7 7',
  forward: 'M5 12h14m-6-7l7 7-7 7',
  reload: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7',
  stop: 'M6 6l12 12M18 6L6 18',
  lock: 'M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z',
  puzzle: 'M10 4a2 2 0 114 0v1h4v4h-1a2 2 0 100 4h1v4h-4v-1a2 2 0 10-4 0v1H6v-4h1a2 2 0 100-4H6V5h4z',
  dots: 'M12 5.5v.01M12 12v.01M12 18.5v.01',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zm9 2l-4.3-4.3',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 010 18M12 3a14 14 0 000 18',
};

/* ── Tab favicons ── */
export function Favicon({ kind, size = 16 }) {
  if (kind === 'df' || kind === 'shield') {
    return <img src="/favicon.svg" alt="" width={size} height={size} style={{ borderRadius: 4 }} />;
  }
  if (kind === 'social') {
    return (
      <span className="pd-fav" style={{ width: size, height: size, background: 'linear-gradient(45deg,#f9ce34,#ee2a7b 50%,#6228d7)' }}>
        <span style={{ width: size * 0.5, height: size * 0.5, border: '1.6px solid #fff', borderRadius: '40%' }} />
      </span>
    );
  }
  return (
    <span className="pd-fav" style={{ width: size, height: size * 0.72, background: '#ff0033', borderRadius: 4 }}>
      <span style={{ borderLeft: `${size * 0.3}px solid #fff`, borderTop: `${size * 0.18}px solid transparent`, borderBottom: `${size * 0.18}px solid transparent` }} />
    </span>
  );
}

const Spinner = () => <span className="pd-spinner" />;

/* ── Omnibox ── */
function Omnibox({ omnibox, compact }) {
  const { text, focused, selected, completion } = omnibox;
  const slash = text.indexOf('/');
  const host = slash === -1 ? text : text.slice(0, slash);
  const path = slash === -1 ? '' : text.slice(slash);

  return (
    <div className={`pd-omnibox ${focused ? 'is-focused' : ''}`} data-demo-target="omnibox">
      <span className="pd-omni-icon">
        <Icon d={focused ? ICONS.search : ICONS.lock} size={13} stroke={2} />
      </span>
      <span className="pd-omni-text">
        {focused ? (
          <>
            <span className={selected ? 'pd-selection' : ''}>{text}</span>
            {!selected && !completion && <span className="pd-caret" />}
            {completion && <span className="pd-selection">{completion}</span>}
          </>
        ) : (
          <>
            <span className="pd-omni-host">{host}</span>
            <span className="pd-omni-path">{path}</span>
          </>
        )}
      </span>
      {!compact && !focused && (
        <span className="pd-omni-star">
          <Icon d={ICONS.star} size={14} />
        </span>
      )}

      {/* Suggestion dropdown while typing */}
      {focused && !selected && text && (
        <div className="pd-omni-drop">
          <div className="pd-omni-row is-active">
            <Icon d={ICONS.globe} size={13} />
            <span>
              <b>{text}</b>
              {completion}
            </span>
          </div>
          <div className="pd-omni-row">
            <Icon d={ICONS.search} size={13} />
            <span>
              {text} <span className="pd-dim">— Google Search</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Extension toolbar button ── */
function ExtensionButton({ on, alert, open }) {
  return (
    <span className={`pd-ext ${open ? 'is-open' : ''}`} data-demo-target="ext-icon">
      <img src="/favicon.svg" alt="" width={16} height={16} style={{ borderRadius: 4 }} />
      {on && <span className="pd-ext-badge">ON</span>}
      {alert && <span className="pd-ext-alert" />}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Browser window (chrome + viewport). Rendered at virtual size.
   ═══════════════════════════════════════════════════════════ */
export function BrowserWindow({ compact, browser, children, overlay, rootRef }) {
  const size = compact ? COMPACT : DESKTOP;
  const { omnibox, loading, loadProgress } = browser;

  return (
    <div ref={rootRef} className={`pd-window ${compact ? 'is-compact' : ''}`} style={{ width: size.winW, height: size.winH }}>
      {!compact && (
        <div className="pd-tabstrip">
          <span className="pd-lights">
            <i className="r" />
            <i className="y" />
            <i className="g" />
          </span>
          <div className="pd-tab">
            {loading ? <Spinner /> : <Favicon kind={browser.icon} size={14} />}
            <span className="pd-tab-title">{browser.title}</span>
            <span className="pd-tab-close">
              <Icon d={ICONS.stop} size={10} stroke={2.2} />
            </span>
          </div>
          <div className="pd-tab is-inactive">
            <Favicon kind="df" size={14} />
            <span className="pd-tab-title">DistractFree — Dashboard</span>
          </div>
          <span className="pd-newtab">+</span>
        </div>
      )}

      <div className="pd-toolbar">
        {compact ? (
          <span className="pd-lights is-small">
            <i className="r" />
            <i className="y" />
            <i className="g" />
          </span>
        ) : (
          <span className="pd-nav">
            <span className={browser.canGoBack ? '' : 'is-disabled'}>
              <Icon d={ICONS.back} />
            </span>
            <span className="is-disabled">
              <Icon d={ICONS.forward} />
            </span>
            <span>
              <Icon d={loading ? ICONS.stop : ICONS.reload} />
            </span>
          </span>
        )}
        <Omnibox omnibox={omnibox} compact={compact} />
        <span className="pd-tools">
          <ExtensionButton on={browser.extensionOn} alert={browser.extensionAlert} open={browser.popupOpen} />
          {!compact && (
            <>
              <span className="pd-tool">
                <Icon d={ICONS.puzzle} size={15} />
              </span>
              <span className="pd-avatar">A</span>
              <span className="pd-tool">
                <Icon d={ICONS.dots} size={16} stroke={2.6} />
              </span>
            </>
          )}
        </span>
        {loading && <span className="pd-loadbar" style={{ transform: `scaleX(${0.08 + loadProgress * 0.92})` }} />}
      </div>

      <div className="pd-viewport" style={{ height: size.winH - size.chrome }}>
        {children}
      </div>
      {overlay}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Monitor (desktop / tablet) and compact window (phones)
   ═══════════════════════════════════════════════════════════ */
export function Monitor({ width, children }) {
  const bezel = width < 700 ? 8 : 12;
  const screenW = Math.max(0, width - bezel * 2);
  const scale = screenW / DESKTOP.screenW;

  return (
    <div className="pd-monitor">
      <div className="pd-bezel" style={{ padding: bezel }}>
        <div className="pd-screen" style={{ height: DESKTOP.screenH * scale }}>
          <div className="pd-scaled" style={{ width: DESKTOP.screenW, height: DESKTOP.screenH, transform: `scale(${scale})` }}>
            <div className="pd-wallpaper" />
            <MenuBar />
            <div className="pd-window-slot" style={{ left: DESKTOP.winX, top: DESKTOP.winY }}>
              {children}
            </div>
          </div>
          <div className="pd-glare" />
        </div>
        <span className="pd-led" />
      </div>
      <div className="pd-stand">
        <div className="pd-neck" />
        <div className="pd-base" />
      </div>
    </div>
  );
}

function MenuBar() {
  return (
    <div className="pd-menubar">
      <span className="pd-menubar-left">
        <b>Chrome</b>
        {['File', 'Edit', 'View', 'History', 'Bookmarks', 'Profiles', 'Tab', 'Window', 'Help'].map((m) => (
          <span key={m}>{m}</span>
        ))}
      </span>
      <span className="pd-menubar-right">
        <svg width="16" height="10" viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="1" y="1" width="19" height="12" rx="3" />
          <rect x="3" y="3" width="12" height="8" rx="1.5" fill="currentColor" stroke="none" />
          <path d="M22 5v4" />
        </svg>
        <Icon d="M2 8.5a15 15 0 0120 0M5.5 12a10 10 0 0113 0M9 15.5a5 5 0 016 0M12 19h.01" size={13} />
        <span>Thu 9:41 AM</span>
      </span>
    </div>
  );
}

export function CompactFrame({ width, children }) {
  const scale = width / COMPACT.winW;
  return (
    <div className="pd-compact" style={{ height: COMPACT.winH * scale }}>
      <div className="pd-scaled" style={{ width: COMPACT.winW, height: COMPACT.winH, transform: `scale(${scale})` }}>
        {children}
      </div>
      <div className="pd-glare is-compact" />
    </div>
  );
}

/* Toast-style overlay used by scenes inside the viewport */
export function ViewportToast({ show, children, position = 'top' }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`pd-toast is-${position}`}
          initial={{ opacity: 0, y: position === 'top' ? -10 : 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: position === 'top' ? -6 : 6 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
