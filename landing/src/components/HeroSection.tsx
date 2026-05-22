'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function HeroSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        ease: [0.21, 1.02, 0.73, 1.0], // custom spring-like ease
      },
    },
  };

  const barHeights = [45, 60, 35, 75, 55, 90, 50]; // Mon-Sun data heights in percent

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-32 pb-24 px-6 overflow-hidden mesh-gradient">
      {/* Background Dot Grid */}
      <div className="absolute inset-0 dot-grid pointer-events-none z-0" />

      {/* Aurora Orbs */}
      <div className="absolute w-[700px] h-[700px] rounded-full bg-brand-purple/10 blur-[100px] -top-[200px] -right-[100px] animate-aurora-a pointer-events-none z-0" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-brand-teal/8 blur-[100px] -bottom-[150px] -left-[50px] animate-aurora-b pointer-events-none z-0" />
      <div className="absolute w-[350px] h-[350px] rounded-full bg-gold/5 blur-[80px] top-[40%] right-[15%] animate-aurora-c pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-[1120px] mx-auto grid grid-cols-1 lg:grid-cols-[55%_45%] gap-12 lg:gap-16 items-center">
        {/* Left Side: Staggered Hero Copy */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col text-left"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="self-start mb-6">
            <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-brand-purple/30 bg-brand-purple/8 text-xs font-semibold text-brand-purple hover:border-brand-purple/50 transition-colors duration-300">
              <span className="w-2 h-2 rounded-full bg-brand-teal animate-pulse-dot" />
              <span>AI-Powered Focus Companion · New: Streak Rewards</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={itemVariants}
            className="text-[clamp(52px,6vw,80px)] font-extrabold leading-[1.0] tracking-[-3px] text-text-primary mb-6"
          >
            Focus should feel <br />
            <span className="shimmer-text">empowering,</span> <br />
            not restrictive.
          </motion.h1>

          {/* Subtext */}
          <motion.p
            variants={itemVariants}
            className="text-[16px] leading-[1.75] text-text-muted max-w-[480px] mb-10"
          >
            DistractFree helps you build sustainable focus habits using AI insights and a reward-based system — instead of forceful blocking.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div variants={itemVariants} className="flex flex-wrap gap-4 items-center mb-10">
            <a
              href="/register"
              className="relative h-14 px-8 rounded-xl font-bold text-white bg-gradient-to-r from-[#6c5ce7] to-[#9d92ff] flex items-center justify-center gap-2 shadow-[0_0_0_0_rgba(108,92,231,0.5)] animate-ripple spring-hover hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(108,92,231,0.45)] active:scale-[0.97]"
            >
              Start Free
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
            <a
              href="#how-it-works"
              className="group flex items-center gap-2.5 h-14 px-8 rounded-xl font-bold bg-white/4 border border-white/10 text-text-primary spring-hover hover:bg-white/8 hover:border-white/20 active:scale-[0.97]"
            >
              <svg
                className="w-4 h-4 text-brand-purple transition-transform duration-300 group-hover:rotate-[90deg]"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              See How It Works
            </a>
          </motion.div>

          {/* Social Proof */}
          <motion.div variants={itemVariants} className="flex items-center gap-4">
            {/* Avatars */}
            <div className="flex -space-x-2.5">
              {[
                'from-brand-purple to-purple-400',
                'from-brand-teal to-teal-400',
                'from-pink-500 to-rose-400',
                'from-blue-500 to-indigo-400',
                'from-gold to-yellow-300',
              ].map((gradient, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full border-2 border-[#050508] bg-gradient-to-tr ${gradient} shadow-md`}
                />
              ))}
            </div>
            <div className="flex flex-col">
              <div className="flex text-gold font-bold text-sm tracking-widest leading-none mb-1">★★★★★</div>
              <p className="text-xs text-text-muted">
                Loved by <span className="text-text-primary font-semibold">2,400+ students & devs</span> · Free to start
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Side: Floating Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.21, 1.02, 0.73, 1.0], delay: 0.2 }}
          className="relative animate-float"
        >
          {/* Glass Card Mockup */}
          <div className="w-full rounded-[20px] bg-[#0c0d16] border border-white/5 shadow-[0_40px_120px_rgba(108,92,231,0.2),0_0_0_1px_rgba(108,92,231,0.1)] overflow-hidden">
            {/* Window Chrome */}
            <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              <div className="ml-4 text-[11px] font-semibold text-text-muted tracking-widest uppercase">
                DistractFree Desktop
              </div>
            </div>

            {/* Dashboard Inside */}
            <div className="p-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {/* Stat 1 */}
                <div className="bg-white/3 border border-white/5 rounded-xl p-3.5 spring-hover hover:border-brand-purple/20">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                    Today's Focus
                  </p>
                  <p className="text-lg font-bold text-text-primary leading-none">2h 25m</p>
                  <p className="text-[10px] font-medium text-brand-teal mt-1">+18% vs yesterday</p>
                </div>
                {/* Stat 2 */}
                <div className="bg-white/3 border border-white/5 rounded-xl p-3.5 spring-hover hover:border-brand-purple/20">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                    Coins
                  </p>
                  <p className="text-lg font-bold text-gold leading-none">340</p>
                  <p className="text-[10px] font-medium text-brand-teal mt-1">+45 earned</p>
                </div>
                {/* Stat 3 */}
                <div className="confetti-border rounded-xl p-3.5 bg-white/3 spring-hover hover:border-brand-purple/20 relative">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                    Streak
                  </p>
                  <p className="text-lg font-bold text-[#f5c842] leading-none">12 Days</p>
                  <p className="text-[10px] font-medium text-brand-teal mt-1">Personal Best!</p>
                </div>
              </div>

              {/* Chart Mockup */}
              <div className="bg-white/2 border border-white/5 rounded-xl p-5">
                <div className="flex justify-between items-center mb-6">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Weekly Performance
                  </p>
                  <span className="text-[10px] font-semibold text-brand-purple px-2 py-0.5 rounded bg-brand-purple/10 border border-brand-purple/20">
                    Active Session Insights
                  </span>
                </div>

                <div className="h-32 flex items-end justify-between gap-2.5 px-2">
                  {barHeights.map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="w-full bg-white/5 rounded-t-md h-full flex items-end">
                        <div
                          className="w-full bg-gradient-to-t from-brand-purple to-purple-400 rounded-t-md animate-bar-grow"
                          style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
                        />
                      </div>
                      <span className="text-[9px] font-medium text-text-muted uppercase tracking-wide">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
