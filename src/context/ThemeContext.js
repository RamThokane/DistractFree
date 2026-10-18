import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Single source of truth for the colour theme ('dark' | 'light').
 * - Saved choice (localStorage 'df-theme') wins; otherwise the OS preference.
 * - public/index.html applies the same logic before React loads (no flash).
 * - The theme is expressed as `dark` / `light` classes on <html>; every colour
 *   comes from CSS variables in index.css that switch on those classes.
 */
export const THEME_KEY = 'df-theme';

const ThemeContext = createContext(null);

const systemTheme = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

const storedTheme = () => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
};

function applyTheme(theme, animate) {
  const root = document.documentElement;
  if (animate) {
    // Colour-only transition while switching; removed afterwards so it never slows normal UI
    root.classList.add('theme-switching');
    window.setTimeout(() => root.classList.remove('theme-switching'), 260);
  }
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#FAF8F5' : '#151412');
}

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => storedTheme() || systemTheme());

  useEffect(() => {
    applyTheme(theme, false);
  }, []);

  // Follow the OS setting until the user picks a theme themselves
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq) return undefined;
    const onChange = () => {
      if (!storedTheme()) {
        const next = mq.matches ? 'light' : 'dark';
        applyTheme(next, true);
        setThemeState(next);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Keep other open tabs in sync
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === THEME_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        applyTheme(e.newValue, true);
        setThemeState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable — theme still applies for this visit */
    }
    applyTheme(next, true);
    setThemeState(next);
  }, []);

  const value = useMemo(
    () => ({ theme, isDark: theme === 'dark', setTheme, toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark') }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

/** Colours for Recharts / SVG props, which can't read CSS variables. */
export const useChartTheme = () => {
  const { isDark } = useTheme();
  // Mirrors styles/tokens.css — SVG chart attributes need literal colours
  return useMemo(
    () =>
      isDark
        ? { axis: '#A39C90', grid: 'rgba(237,233,225,0.08)', label: '#A39C90', tooltipBg: '#201F1C', tooltipBorder: 'rgba(237,233,225,0.12)', tooltipText: '#EDE9E1', cursor: 'rgba(237,233,225,0.05)', track: '#282622',
            accent: '#7FC2A3', accentMuted: '#3A3732', amber: '#E0B04A', danger: '#E58C78', text: '#EDE9E1', muted: '#A39C90', surface: '#201F1C' }
        : { axis: '#6B645A', grid: 'rgba(28,27,25,0.08)', label: '#6B645A', tooltipBg: '#FFFFFF', tooltipBorder: 'rgba(28,27,25,0.12)', tooltipText: '#1C1B19', cursor: 'rgba(28,27,25,0.04)', track: '#E8E2D8',
            accent: '#1F5E4A', accentMuted: '#DCD5C9', amber: '#C8901E', danger: '#A63D2A', text: '#1C1B19', muted: '#6B645A', surface: '#FFFFFF' },
    [isDark]
  );
};
