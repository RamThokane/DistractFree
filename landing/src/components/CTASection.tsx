'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function CTASection() {
  const scrollAnimation = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: [0.21, 1.02, 0.73, 1.0] as const },
    viewport: { once: true, margin: '-80px' },
  };

  // Particles config
  const particles = [
    { left: '10%', top: '70%', size: '6px', delay: '0s', color: 'bg-brand-purple/20' },
    { left: '25%', top: '40%', size: '4px', delay: '1s', color: 'bg-brand-teal/20' },
    { left: '40%', top: '80%', size: '8px', delay: '2s', color: 'bg-gold/20' },
    { left: '60%', top: '30%', size: '5px', delay: '0.5s', color: 'bg-brand-purple/20' },
    { left: '75%', top: '65%', size: '7px', delay: '1.5s', color: 'bg-brand-teal/20' },
    { left: '90%', top: '50%', size: '4px', delay: '2.5s', color: 'bg-gold/20' },
    { left: '15%', top: '20%', size: '5px', delay: '3s', color: 'bg-brand-teal/15' },
    { left: '85%', top: '85%', size: '6px', delay: '1.2s', color: 'bg-brand-purple/15' },
  ];

  return (
    <section
      className="relative w-full py-[120px] px-6 overflow-hidden flex flex-col items-center justify-center text-center"
      style={{
        background: 'radial-gradient(circle at center, rgba(124,111,239,0.15) 0%, transparent 60%)',
      }}
    >
      {/* Thin Gradient Line Above Section */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-purple/40 to-transparent" />

      {/* Floating Particles (CSS only) */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {particles.map((p, idx) => (
          <div
            key={idx}
            className={`absolute rounded-full ${p.color} animate-particle`}
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-[1120px] mx-auto flex flex-col items-center">
        {/* Headline */}
        <motion.h2
          {...scrollAnimation}
          className="text-[clamp(44px,6vw,64px)] font-extrabold tracking-[-3px] leading-none text-text-primary mb-6"
        >
          Build better focus habits.
        </motion.h2>

        {/* Subtext */}
        <motion.p
          {...scrollAnimation}
          className="text-lg text-text-muted mb-10 max-w-[500px]"
        >
          Free to start. No credit card required. Join 2,400+ developers, designers, and students leveling up their focus.
        </motion.p>

        {/* Primary CTA Button (56px tall) */}
        <motion.div {...scrollAnimation}>
          <a
            href="/register"
            className="relative h-14 px-10 rounded-xl font-bold text-white bg-gradient-to-r from-[#6c5ce7] to-[#9d92ff] flex items-center justify-center gap-2 shadow-[0_0_0_0_rgba(108,92,231,0.5)] animate-ripple spring-hover hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(108,92,231,0.5)] active:scale-[0.97]"
          >
            Start Focus Journey
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
