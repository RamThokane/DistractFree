'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function HowItWorksSection() {
  const scrollAnimation = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.21, 1.02, 0.73, 1.0] },
    viewport: { once: true, margin: '-80px' },
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 35 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.21, 1.02, 0.73, 1.0] },
    },
  };

  return (
    <section id="how-it-works" className="relative w-full py-[100px] px-6 bg-[#050508] overflow-hidden">
      {/* Background decoration */}
      <div className="absolute w-[400px] h-[400px] rounded-full bg-brand-teal/5 blur-[100px] top-[20%] left-[-100px] pointer-events-none" />

      <div className="max-w-[1120px] mx-auto relative">
        {/* Header */}
        <motion.div {...scrollAnimation} className="mb-16">
          <p className="text-[11px] font-bold tracking-[1.8px] uppercase text-brand-purple mb-3">
            How It Works
          </p>
          <h2 className="text-[clamp(36px,4vw,52px)] font-bold tracking-[-2px] leading-tight text-text-primary">
            Three steps to sustainable focus.
          </h2>
        </motion.div>

        {/* Animated Connector Path (Desktop only) */}
        <div className="hidden md:block absolute top-[140px] left-[15%] right-[15%] h-px pointer-events-none z-0">
          <svg className="w-full h-8 overflow-visible" fill="none">
            <motion.path
              d="M 0 10 Q 200 40 400 10 Q 600 -20 800 10"
              stroke="rgba(124, 111, 239, 0.25)"
              strokeWidth="1.5"
              strokeDasharray="6 6"
              initial={{ strokeDashoffset: 100 }}
              whileInView={{ strokeDashoffset: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 3, ease: 'linear', repeat: Infinity }}
            />
          </svg>
        </div>

        {/* Grid of Steps */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10"
        >
          {/* Step 1 */}
          <motion.div
            variants={cardVariants}
            className="flex flex-col rounded-[20px] border border-white/5 bg-[#0c0d16]/80 backdrop-blur-[12px] p-6 hover:border-brand-purple/25 spring-hover hover:-translate-y-1 group"
          >
            {/* Step Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-[1.8px] text-brand-purple px-2.5 py-1 rounded-full bg-brand-purple/10 border border-brand-purple/20">
                  01
                </span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Session
                </span>
              </div>
              <span className="text-xs font-semibold text-brand-purple font-mono">25:00</span>
            </div>

            {/* Mockup 1: Focus Timer Progress */}
            <div className="bg-white/2 border border-white/5 rounded-xl p-4 mb-6 flex flex-col justify-center h-28">
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-4">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '45%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
                  className="h-full bg-gradient-to-r from-brand-purple to-purple-400 rounded-full"
                />
              </div>
              <div className="flex justify-center items-center gap-3">
                <button className="w-7 h-7 rounded-full bg-brand-purple/20 border border-brand-purple/30 flex items-center justify-center text-brand-purple hover:scale-105 active:scale-95 transition-transform duration-200">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
                <button className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-muted">
                  <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Step Copy */}
            <h3 className="text-lg font-bold text-text-primary mb-2 group-hover:text-brand-purple transition-colors duration-300">
              Start a Focus Session
            </h3>
            <p className="text-sm text-text-muted leading-relaxed">
              Choose your duration, hit start, and enter a distraction-aware focus state.
            </p>
          </motion.div>

          {/* Step 2 */}
          <motion.div
            variants={cardVariants}
            className="flex flex-col rounded-[20px] border border-white/5 bg-[#0c0d16]/80 backdrop-blur-[12px] p-6 hover:border-brand-purple/25 spring-hover hover:-translate-y-1 group"
          >
            {/* Step Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-[1.8px] text-brand-purple px-2.5 py-1 rounded-full bg-brand-purple/10 border border-brand-purple/20">
                  02
                </span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Rewards
                </span>
              </div>
              <span className="text-xs font-semibold text-gold font-mono">+20 Coins</span>
            </div>

            {/* Mockup 2: Earn Coins 3D Spin */}
            <div className="bg-white/2 border border-white/5 rounded-xl p-4 mb-6 flex items-center justify-between h-28 overflow-hidden">
              <div className="flex items-center gap-3">
                {/* 3D coin icon */}
                <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center text-lg shadow-[0_0_20px_rgba(245,200,66,0.2)] animate-coin-flip border border-gold/30">
                  🪙
                </div>
                <div>
                  <motion.p
                    initial={{ scale: 0.8, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="text-sm font-bold text-gold"
                  >
                    +20 Focus Coins
                  </motion.p>
                  <p className="text-[10px] text-text-muted">For 25 min focused session</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[9px] font-bold text-brand-teal uppercase">340 Total</span>
                <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="w-[85%] h-full bg-brand-teal rounded-full" />
                </div>
              </div>
            </div>

            {/* Step Copy */}
            <h3 className="text-lg font-bold text-text-primary mb-2 group-hover:text-brand-purple transition-colors duration-300">
              Earn Focus Coins
            </h3>
            <p className="text-sm text-text-muted leading-relaxed">
              Every focused minute earns coins. Longer sessions are worth more — consistency is rewarded.
            </p>
          </motion.div>

          {/* Step 3 */}
          <motion.div
            variants={cardVariants}
            className="flex flex-col rounded-[20px] border border-white/5 bg-[#0c0d16]/80 backdrop-blur-[12px] p-6 hover:border-brand-purple/25 spring-hover hover:-translate-y-1 group"
          >
            {/* Step Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-[1.8px] text-brand-purple px-2.5 py-1 rounded-full bg-brand-purple/10 border border-brand-purple/20">
                  03
                </span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Control
                </span>
              </div>
              <span className="text-xs font-semibold text-brand-teal font-mono">Break Options</span>
            </div>

            {/* Mockup 3: Unlock Breaks */}
            <div className="bg-white/2 border border-white/5 rounded-xl p-3.5 mb-6 flex flex-col justify-between h-28 text-left">
              <div className="flex items-center justify-between p-1.5 px-2 bg-brand-purple/10 border border-brand-purple/20 border-l-[3px] border-l-brand-purple rounded-lg text-[10px]">
                <span className="font-semibold text-text-primary">5 min break</span>
                <span className="flex items-center gap-1 font-bold text-gold">🪙 10</span>
              </div>
              <div className="flex items-center justify-between p-1.5 px-2 border border-transparent rounded-lg text-[10px] opacity-40">
                <span className="font-medium text-text-muted">15 min break</span>
                <span className="flex items-center gap-1 text-gold">🪙 25</span>
              </div>
            </div>

            {/* Step Copy */}
            <h3 className="text-lg font-bold text-text-primary mb-2 group-hover:text-brand-purple transition-colors duration-300">
              Unlock breaks intentionally
            </h3>
            <p className="text-sm text-text-muted leading-relaxed">
              Spend coins on controlled break time. You choose when — it's always your decision.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
