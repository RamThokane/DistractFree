import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const BRAND = 'DistractFree';
export const HOME_TITLE = 'DistractFree · Focus should feel empowering';

/* Short per-page tab titles; the brand goes last so the page name shows first */
const TITLES = {
  '/': HOME_TITLE,
  '/login': 'Sign in',
  '/register': 'Create your account',
  '/forgot-password': 'Forgot password',
  '/reset-password': 'Choose a new password',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Service',
  '/dashboard': 'Dashboard',
  '/dashboard/focus': 'Focus session',
  '/dashboard/calendar': 'Calendar',
  '/dashboard/coins': 'Coins',
  '/dashboard/insights': 'AI Insights',
  '/dashboard/coach': 'Focus coach',
  '/dashboard/weekly-report': 'Weekly report',
  '/dashboard/heatmap': 'Focus heatmap',
  '/dashboard/leaderboard': 'Leaderboard',
  '/dashboard/settings': 'Settings',
  '/styleguide': 'Design system',
};

export const pageTitle = (name) => (name === HOME_TITLE ? HOME_TITLE : `${name} — ${BRAND}`);

/** Sets document.title from the route. Renders nothing. */
const RouteTitle = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const path = pathname.replace(/\/+$/, '') || '/';
    document.title = pageTitle(TITLES[path] || HOME_TITLE);
  }, [pathname]);
  return null;
};

export default RouteTitle;
