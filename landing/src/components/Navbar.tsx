'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface NavItem {
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Product', href: '#product' },
  { label: 'Research', href: '#research' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0.1,
    };

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(`#${entry.target.id}`);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, observerOptions);

    const sections = ['how-it-works', 'product', 'research'];
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] border-b transition-all duration-300 ${
        scrolled
          ? 'bg-[#050508]/80 backdrop-blur-2xl border-white/5 shadow-[0_1px_40px_rgba(0,0,0,0.6)]'
          : 'bg-[#050508]/40 backdrop-blur-xl border-white/[0.03]'
      }`}
    >
      <div className="max-w-[1120px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c6fef] to-[#a29bfe] flex items-center justify-center spring-hover group-hover:scale-105 shadow-[0_0_15px_rgba(124,111,239,0.3)]">
            <span className="text-white font-extrabold text-sm tracking-tight">D</span>
          </div>
          <span className="font-semibold text-text-primary tracking-tight text-lg">
            DistractFree
          </span>
        </a>

        {/* Center Navigation Links (Desktop) */}
        <div className="hidden md:flex items-center gap-1 bg-[#0c0d16]/60 border border-white/5 rounded-full p-1">
          {navItems.map((item) => {
            const isActive = activeSection === item.href;
            return (
              <a
                key={item.label}
                href={item.href}
                className="relative px-4 py-1.5 text-xs font-medium tracking-wide uppercase rounded-full transition-colors duration-200 text-text-muted hover:text-text-primary"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-brand-purple/10 border border-brand-purple/20 rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </a>
            );
          })}
        </div>

        {/* Right CTA / Buttons */}
        <div className="hidden md:flex items-center gap-4">
          <a
            href="/login"
            className="text-xs font-semibold text-text-muted hover:text-text-primary uppercase tracking-wider spring-hover"
          >
            Log In
          </a>
          <a
            href="/register"
            className="relative px-5 py-2.5 rounded-[10px] text-xs font-bold text-white bg-gradient-to-br from-[#6c5ce7] to-[#9d92ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_0_20px_rgba(108,92,231,0.2)] spring-hover hover:scale-[1.02] hover:brightness-110 active:scale-[0.97]"
          >
            Start Free
          </a>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden absolute top-16 left-0 right-0 bg-[#050508] border-b border-white/5 py-4 px-6 flex flex-col gap-4 shadow-2xl"
        >
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-text-muted hover:text-text-primary py-2"
            >
              {item.label}
            </a>
          ))}
          <hr className="border-white/5 my-1" />
          <div className="flex flex-col gap-3">
            <a
              href="/login"
              className="text-sm font-medium text-text-muted hover:text-text-primary py-2 text-center"
            >
              Log In
            </a>
            <a
              href="/register"
              className="px-5 py-3 rounded-[10px] text-sm font-bold text-center text-white bg-gradient-to-br from-[#6c5ce7] to-[#9d92ff]"
            >
              Start Free
            </a>
          </div>
        </motion.div>
      )}
    </nav>
  );
}
