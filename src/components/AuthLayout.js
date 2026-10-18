import React from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import AuthShowcase from './AuthShowcase';
import Wordmark from './Wordmark';

/**
 * Login / sign-up frame: form column on the left, brand panel on the right
 * (desktop only). Same paper, type and components as the rest of the site.
 */
const AuthLayout = ({ title, subtitle, children, footer }) => (
  <div className="df-grain min-h-screen flex bg-paper text-text">
    <div className="w-full lg:w-[46%] flex flex-col">
      <header className="px-6 sm:px-12 lg:px-16 pt-8 flex items-center justify-between">
        <Link to="/" className="app-brand" aria-label="DistractFree home">
          <img src="/favicon.svg" alt="" className="w-8 h-8 rounded-md" />
          <Wordmark className="df-wordmark--logo" />
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-12">
        <div className="w-full max-w-[400px] mx-auto df-in">
          <h1 className="df-display text-t-40 sm:text-[3rem] leading-none">{title}</h1>
          {subtitle && <p className="text-muted mt-3 mb-8">{subtitle}</p>}
          {children}
        </div>
      </main>

      <footer className="px-6 sm:px-12 lg:px-16 pb-8 text-sm text-muted text-center lg:text-left">{footer}</footer>
    </div>

    <AuthShowcase />
  </div>
);

/** Turn an API failure into something a person can act on. */
export const friendlyAuthError = (err, fallback) => {
  if (!err?.response) return 'We couldn’t reach DistractFree. Check your connection and try again.';
  const { status, data } = err.response;
  if (status === 429) return 'Too many attempts. Wait a minute, then try again.';
  if (status === 503 && data?.message) return data.message; // e.g. reset email not set up yet
  if (status >= 500) return 'Something went wrong on our side. Try again in a moment.';
  return data?.errors?.[0]?.message || data?.message || fallback;
};

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export default AuthLayout;
