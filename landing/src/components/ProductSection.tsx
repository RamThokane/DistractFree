'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function ProductSection() {
  const scrollAnimation = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.21, 1.02, 0.73, 1.0] },
    viewport: { once: true, margin: '-80px' },
  };

  return (
    <section id="product" className="relative w-full py-[100px] px-6 bg-[#080a14] overflow-hidden">
      <div className="max-w-[1120px] mx-auto">
        {/* Header */}
        <motion.div {...scrollAnimation} className="text-center mb-16">
          <p className="text-[11px] font-bold tracking-[1.8px] uppercase text-brand-purple mb-3">
            Product Features
          </p>
          <h2 className="text-[clamp(36px,4vw,52px)] font-bold tracking-[-2px] leading-tight text-text-primary">
            See what you're building toward.
          </h2>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 1. Analytics Card (wide: 3 cols) */}
          <motion.div
            {...scrollAnimation}
            className="lg:col-span-3 rounded-[20px] border border-white/6 bg-[#0a0b14]/90 p-6 overflow-hidden spring-hover hover:border-brand-purple/20 hover:scale-[1.01]"
          >
            <div className="flex justify-between items-center mb-6">
              <span className="text-[10px] font-bold text-brand-purple uppercase tracking-wider">
                Analytics
              </span>
              <span className="text-[11px] font-bold text-brand-teal bg-brand-teal/15 px-2 py-0.5 rounded border border-brand-teal/20">
                +3.2h vs last week
              </span>
            </div>

            {/* SVG Line Chart with draw-in effect */}
            <div className="relative h-44 mb-6">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150">
                <defs>
                  <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c6fef" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#7c6fef" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Grid Lines */}
                <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="0" y1="75" x2="500" y2="75" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="0" y1="120" x2="500" y2="120" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

                {/* Fill Path */}
                <motion.path
                  d="M 0 130 C 50 110, 100 120, 150 90 C 200 60, 250 85, 300 45 C 350 5, 400 40, 500 10 L 500 150 L 0 150 Z"
                  fill="url(#chartGlow)"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1 }}
                />

                {/* Draw-in Line Path */}
                <motion.path
                  d="M 0 130 C 50 110, 100 120, 150 90 C 200 60, 250 85, 300 45 C 350 5, 400 40, 500 10"
                  fill="none"
                  stroke="#7c6fef"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="600"
                  initial={{ strokeDashoffset: 600 }}
                  whileInView={{ strokeDashoffset: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                />

                {/* Points */}
                <circle cx="300" cy="45" r="4" fill="#7c6fef" />
                <circle cx="500" cy="10" r="4" fill="#7c6fef" />
              </svg>
            </div>

            {/* Stat Boxes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/3 border border-white/5 rounded-xl p-3.5">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  This Week Focus
                </p>
                <p className="text-xl font-bold text-text-primary">18.5 hrs</p>
              </div>
              <div className="bg-white/3 border border-white/5 rounded-xl p-3.5">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Focus Score
                </p>
                <p className="text-xl font-bold text-[#7c6fef]">78/100</p>
              </div>
            </div>
          </motion.div>

          {/* 2. Focus Timer Card (narrow: 2 cols) */}
          <motion.div
            {...scrollAnimation}
            className="lg:col-span-2 rounded-[20px] border border-white/6 bg-[#0a0b14]/90 p-6 overflow-hidden spring-hover hover:border-brand-purple/20 hover:scale-[1.01]"
          >
            <span className="text-[10px] font-bold text-brand-purple uppercase tracking-wider mb-6 block">
              Focus Timer
            </span>

            {/* Ring Timer */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative w-28 h-28 flex items-center justify-center">
                {/* SVG Ring */}
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    stroke="rgba(255, 255, 255, 0.04)"
                    strokeWidth="5"
                    fill="transparent"
                  />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="44"
                    stroke="#00d2c8"
                    strokeWidth="5"
                    fill="transparent"
                    strokeDasharray="276"
                    initial={{ strokeDashoffset: 276 }}
                    whileInView={{ strokeDashoffset: 70 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-xl font-bold text-text-primary font-mono tracking-tight">
                  18:32
                </span>
              </div>
            </div>

            {/* Activity Log */}
            <div className="space-y-3 bg-white/2 border border-white/5 rounded-xl p-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-muted">Focus Session (25m)</span>
                <span className="font-semibold text-brand-teal">+20 Coins</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-muted">Unlocked 5m break</span>
                <span className="font-semibold text-red-400">-10 Coins</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-muted">Streak Reward</span>
                <span className="font-semibold text-gold">+50 Coins</span>
              </div>
            </div>
          </motion.div>

          {/* 3. Smart Blocking Card (narrow: 2 cols) */}
          <motion.div
            {...scrollAnimation}
            className="lg:col-span-2 rounded-[20px] border border-white/6 bg-[#0a0b14]/90 p-6 overflow-hidden flex flex-col justify-between spring-hover hover:border-brand-purple/20 hover:scale-[1.01]"
          >
            <div>
              <span className="text-[10px] font-bold text-brand-purple uppercase tracking-wider mb-6 block">
                Smart Blocking
              </span>

              {/* Browser chrome mockup */}
              <div className="border border-white/5 rounded-xl overflow-hidden bg-[#0c0d16] mb-6">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5 bg-white/2">
                  <div className="w-2 h-2 rounded-full bg-[#ff5f56]" />
                  <div className="w-2 h-2 rounded-full bg-[#ffbd2e]" />
                  <div className="w-2 h-2 rounded-full bg-[#27c93f]" />
                  <div className="flex-1 mx-2">
                    <div className="bg-white/4 rounded px-2 py-0.5 text-[9px] text-center text-text-muted font-mono overflow-hidden">
                      twitter.com
                    </div>
                  </div>
                </div>

                <div className="p-5 flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full bg-brand-purple/10 flex items-center justify-center text-brand-purple mb-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p className="text-xs font-bold text-text-primary mb-1">This site is paused</p>
                  <p className="text-lg font-bold text-brand-purple font-mono mb-4">18:42</p>

                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f5c842]/10 border border-[#f5c842]/20 text-[10px] font-bold text-gold spring-hover hover:scale-105 active:scale-95">
                    <span className="w-2 h-2 rounded-full bg-[#f5c842] animate-pulse-dot" />
                    Unlock using 10 Focus Coins
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 4. AI Insights Card (wide: 3 cols) */}
          <motion.div
            {...scrollAnimation}
            className="lg:col-span-3 rounded-[20px] border border-white/6 bg-[#0a0b14]/90 p-6 overflow-hidden flex flex-col justify-between spring-hover hover:border-brand-purple/20 hover:scale-[1.01]"
          >
            <div>
              <span className="text-[10px] font-bold text-brand-purple uppercase tracking-wider mb-4 block">
                AI Insights
              </span>
              <p className="text-sm font-bold text-text-primary mb-6">
                Distraction Risk by Time
              </p>

              {/* Mini SVG area chart for risk curve */}
              <div className="h-28 mb-6">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120">
                  <defs>
                    <linearGradient id="aiGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00d2c8" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#00d2c8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Risk line */}
                  <motion.path
                    d="M 0 100 Q 125 110 250 40 T 500 20"
                    fill="none"
                    stroke="#00d2c8"
                    strokeWidth="2"
                    strokeDasharray="500"
                    initial={{ strokeDashoffset: 500 }}
                    whileInView={{ strokeDashoffset: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                  />
                  <path
                    d="M 0 100 Q 125 110 250 40 T 500 20 L 500 120 L 0 120 Z"
                    fill="url(#aiGlow)"
                  />
                  <circle cx="375" cy="30" r="4" fill="#00d2c8" />

                  {/* Horizontal Labels */}
                  <text x="10" y="118" fill="rgba(255,255,255,0.25)" fontSize="9" fontWeight="bold">8 AM</text>
                  <text x="160" y="118" fill="rgba(255,255,255,0.25)" fontSize="9" fontWeight="bold">12 PM</text>
                  <text x="310" y="118" fill="rgba(255,255,255,0.25)" fontSize="9" fontWeight="bold">4 PM</text>
                  <text x="460" y="118" fill="rgba(255,255,255,0.25)" fontSize="9" fontWeight="bold">8 PM</text>
                </svg>
              </div>
            </div>

            {/* AI Insights lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="border-l-2 border-[#7c6fef] bg-white/2 rounded-r-lg p-3">
                <p className="text-xs font-bold text-text-primary mb-0.5">Peak distraction risk at 4:00 PM</p>
                <p className="text-[10px] text-text-muted leading-relaxed">Consider shifting complex tasks to early morning.</p>
              </div>
              <div className="border-l-2 border-[#00d2c8] bg-white/2 rounded-r-lg p-3">
                <p className="text-xs font-bold text-text-primary mb-0.5">Morning focus is 40% higher</p>
                <p className="text-[10px] text-text-muted leading-relaxed">You complete 2x more focus sessions before noon.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
