'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function AISection() {
  const scrollAnimation = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.21, 1.02, 0.73, 1.0] as const },
    viewport: { once: true, margin: '-80px' },
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const pillVariants = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  return (
    <section className="relative w-full py-[100px] px-6 bg-[#050508] overflow-hidden">
      <div className="absolute w-[500px] h-[500px] rounded-full bg-brand-purple/5 blur-[120px] bottom-[-100px] right-[-100px] pointer-events-none" />

      <div className="max-w-[1120px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left: Copy & Insight Pills */}
        <motion.div {...scrollAnimation} className="flex flex-col">
          <p className="text-[11px] font-bold tracking-[1.8px] uppercase text-brand-purple mb-4">
            AI Transparency
          </p>
          <h2 className="text-[clamp(36px,4vw,52px)] font-bold tracking-[-2px] leading-tight text-text-primary mb-6">
            AI that explains itself.
          </h2>
          <p className="text-[16px] leading-[1.75] text-text-muted mb-8 max-w-[480px]">
            We use simple, explainable models to predict your distraction patterns. Every recommendation comes with a clear reason — no black-box decisions.
          </p>

          {/* Staggered Insight Pills */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="space-y-4"
          >
            {[
              {
                border: 'border-l-brand-purple',
                title: 'Pattern detection',
                desc: 'Your distraction risk increases after 45 minutes. Try 40-minute sessions.',
              },
              {
                border: 'border-l-brand-teal',
                title: 'Optimal timing',
                desc: 'Your focus peaks between 9-11 AM. Schedule deep work then.',
              },
              {
                border: 'border-l-gold',
                title: 'Habit tracking',
                desc: "You've reduced social media by 34% this week. Keep it up.",
              },
            ].map((insight, idx) => (
              <motion.div
                key={idx}
                variants={pillVariants}
                className={`bg-white/2 rounded-r-xl border-l-[3px] ${insight.border} p-4.5 spring-hover hover:bg-white/4`}
              >
                <h4 className="text-sm font-bold text-text-primary mb-1">{insight.title}</h4>
                <p className="text-xs text-text-muted leading-relaxed">{insight.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Right: Premium AI risk chart mockup */}
        <motion.div
          {...scrollAnimation}
          className="relative bg-[#0c0d16] border border-white/5 rounded-[20px] p-6 shadow-[0_30px_60px_rgba(0,0,0,0.4)] overflow-hidden"
        >
          <div className="flex justify-between items-center mb-6">
            <span className="text-xs font-bold text-text-primary">Distraction Risk by Time</span>
            <span className="text-[10px] font-bold text-brand-teal uppercase tracking-wider bg-brand-teal/10 px-2 py-0.5 rounded border border-brand-teal/20">
              Live Predictive Model
            </span>
          </div>

          <div className="relative h-60 w-full">
            {/* SVG Grid and Chart */}
            <svg className="w-full h-full overflow-visible" viewBox="0 0 400 200">
              <defs>
                <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d2c8" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#00d2c8" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="20" x2="400" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              <line x1="0" y1="70" x2="400" y2="70" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              <line x1="0" y1="120" x2="400" y2="120" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              <line x1="0" y1="170" x2="400" y2="170" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

              {/* Y Axis Labels */}
              <text x="390" y="24" fill="rgba(240,240,245,0.2)" fontSize="8" textAnchor="end" fontWeight="bold">100</text>
              <text x="390" y="74" fill="rgba(240,240,245,0.2)" fontSize="8" textAnchor="end" fontWeight="bold">50</text>
              <text x="390" y="174" fill="rgba(240,240,245,0.2)" fontSize="8" textAnchor="end" fontWeight="bold">0</text>

              {/* Area path */}
              <path
                d="M 0 170 C 50 160, 100 150, 150 110 C 200 70, 250 130, 280 60 C 310 -10, 350 40, 400 30 L 400 170 Z"
                fill="url(#tealGrad)"
              />

              {/* Stroke path drawing */}
              <motion.path
                d="M 0 170 C 50 160, 100 150, 150 110 C 200 70, 250 130, 280 60 C 310 -10, 350 40, 400 30"
                fill="none"
                stroke="#00d2c8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="500"
                initial={{ strokeDashoffset: 500 }}
                whileInView={{ strokeDashoffset: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 1.8, ease: 'easeInOut' }}
              />

              {/* Interactive Circle at peak */}
              <circle cx="300" cy="20" r="4.5" fill="#00d2c8" />
              <circle cx="300" cy="20" r="9" stroke="#00d2c8" strokeWidth="1.5" fill="none" className="animate-pulse-dot" />
            </svg>

            {/* Peak Tooltip popup */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 1 }}
              className="absolute top-[5px] left-[62%] -translate-x-1/2 bg-[#17192c] border border-brand-teal/30 rounded-lg p-2.5 shadow-2xl flex flex-col items-center pointer-events-none"
            >
              <span className="text-[8px] font-bold text-brand-teal uppercase tracking-widest leading-none mb-1">
                Peak Risk (4 PM)
              </span>
              <span className="text-sm font-black text-text-primary leading-none">78%</span>
            </motion.div>
          </div>

          {/* Time axis labels */}
          <div className="flex justify-between items-center px-2 mt-4 text-[10px] font-bold text-text-muted">
            <span>8 AM</span>
            <span>12 PM</span>
            <span>4 PM</span>
            <span>8 PM</span>
            <span>10 PM</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
