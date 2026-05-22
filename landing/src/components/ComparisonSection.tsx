'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function ComparisonSection() {
  const scrollAnimation = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.21, 1.02, 0.73, 1.0] },
    viewport: { once: true, margin: '-80px' },
  };

  const listStagger = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const listItem = {
    hidden: { opacity: 0, x: -10 },
    show: { opacity: 1, x: 0, transition: { duration: 0.4 } },
  };

  return (
    <section className="relative w-full py-[100px] px-6 bg-[#080a14] overflow-hidden">
      <div className="max-w-[1120px] mx-auto">
        {/* Title */}
        <motion.div {...scrollAnimation} className="mb-16">
          <h2 className="text-[clamp(36px,4vw,52px)] font-bold tracking-[-2px] leading-tight text-text-primary">
            Most website blockers punish. <br />
            <span className="text-text-muted">We motivate.</span>
          </h2>
        </motion.div>

        {/* Comparison Grid */}
        <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-8 md:gap-4 items-center">
          {/* Traditional Blockers Card */}
          <motion.div
            {...scrollAnimation}
            className="bg-white/2 border border-white/5 rounded-[20px] p-8 md:p-10 spring-hover hover:border-white/10"
          >
            <p className="text-[11px] font-bold tracking-[1.8px] uppercase text-text-muted mb-8">
              Traditional Blockers
            </p>
            <motion.ul
              variants={listStagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="space-y-6"
            >
              {[
                'Harsh restrictions that create frustration',
                'Easy to bypass — a quick incognito tab away',
                'Short-term control with no lasting habits',
              ].map((item, index) => (
                <motion.li key={index} variants={listItem} className="flex items-start gap-4">
                  <div className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-text-muted leading-relaxed">{item}</span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>

          {/* Vertical Divider (Desktop) / Horizontal Divider (Mobile) */}
          <div className="relative flex md:flex-col items-center justify-center py-4 md:py-0 md:h-full md:px-4">
            <div className="w-full h-px md:w-px md:h-[200px] bg-white/10" />
            <div className="absolute w-8 h-8 rounded-full bg-[#0c0d16] border border-white/10 flex items-center justify-center text-[10px] font-bold text-text-muted shadow-lg">
              VS
            </div>
            <div className="w-full h-px md:w-px md:h-[200px] bg-white/10 hidden md:block" />
          </div>

          {/* DistractFree Card */}
          <motion.div
            {...scrollAnimation}
            className="relative bg-brand-purple/5 border border-brand-purple/15 rounded-[20px] p-8 md:p-10 overflow-hidden shadow-[inset_0_0_60px_rgba(124,111,239,0.07)] spring-hover hover:border-brand-purple/35 hover:shadow-[inset_0_0_80px_rgba(124,111,239,0.1)]"
          >
            {/* Top edge gradient accent line */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-purple to-transparent" />

            <p className="text-[11px] font-bold tracking-[1.8px] uppercase text-brand-purple mb-8">
              DistractFree
            </p>
            <motion.ul
              variants={listStagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="space-y-6"
            >
              {[
                'Reward-based system that makes focus feel good',
                'AI-guided insights that adapt to your patterns',
                'Long-term habit building, not temporary fixes',
              ].map((item, index) => (
                <motion.li key={index} variants={listItem} className="flex items-start gap-4">
                  <div className="w-5 h-5 rounded-full bg-brand-teal/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-brand-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-text-primary leading-relaxed">{item}</span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
