import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════
   HowItWorksWalkthrough — Premium Animated Product Demo
   Auto-cycling 6-frame walkthrough using existing UI patterns
   ═══════════════════════════════════════════════════════════ */

const FRAME_DURATION = 4000; // ms per frame

const STEPS = [
  {
    id: 1,
    label: 'Start Focus Session',
    caption: 'Choose your duration and begin a distraction-aware session',
  },
  {
    id: 2,
    label: 'Extension Activates',
    caption: 'Chrome extension monitors and protects your focus',
  },
  {
    id: 3,
    label: 'Distractions Blocked',
    caption: 'Blocked sites are intercepted before they break your flow',
  },
  {
    id: 4,
    label: 'Earn Focus Coins',
    caption: 'Complete sessions to earn coins as a reward',
  },
  {
    id: 5,
    label: 'Unlock Intentionally',
    caption: 'Spend coins to take controlled, mindful breaks',
  },
  {
    id: 6,
    label: 'AI Insights Update',
    caption: 'Dashboard tracks your progress with AI-powered analytics',
  },
];

/* ── Shared transition config ── */
const frameFade = {
  initial: { opacity: 0, y: 12, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
};

/* ═══════════ FRAME COMPONENTS ═══════════ */

/* Frame 1 — Focus Session Timer */
const Frame1 = () => (
  <motion.div {...frameFade} className="wt-frame">
    <div className="wt-browser">
      <div className="wt-titlebar">
        <div className="wt-dots"><span className="wt-dot-r" /><span className="wt-dot-y" /><span className="wt-dot-g" /></div>
        <span className="wt-title">DistractFree — Focus Session</span>
      </div>
      <div className="wt-content">
        {/* Preset pills */}
        <div className="flex flex-wrap gap-2 mb-5 justify-center">
          {['25 min', '50 min', '90 min'].map((t, i) => (
            <span key={i} className={`wt-pill ${i === 0 ? 'wt-pill-active' : ''}`}>{t}</span>
          ))}
        </div>

        {/* Timer ring */}
        <div className="flex justify-center mb-5">
          <div className="wt-timer-ring">
            <svg viewBox="0 0 100 100" className="wt-timer-svg">
              <circle cx="50" cy="50" r="42" className="wt-ring-bg" />
              <motion.circle
                cx="50" cy="50" r="42"
                className="wt-ring-fill"
                strokeDasharray="264"
                initial={{ strokeDashoffset: 264 }}
                animate={{ strokeDashoffset: 66 }}
                transition={{ duration: 3, ease: 'easeInOut' }}
              />
            </svg>
            <div className="wt-timer-label">
              <span className="wt-timer-time">18:42</span>
              <span className="wt-timer-sub">Stay focused...</span>
            </div>
          </div>
        </div>

        {/* Coins indicator */}
        <div className="wt-coins-badge">
          <span>🪙</span>
          <span>Earn up to <strong style={{ color: '#f0c040' }}>10</strong> coins</span>
        </div>
      </div>
    </div>
  </motion.div>
);

/* Frame 2 — Extension Popup */
const Frame2 = () => (
  <motion.div {...frameFade} className="wt-frame">
    <div className="wt-browser">
      <div className="wt-titlebar">
        <div className="wt-dots"><span className="wt-dot-r" /><span className="wt-dot-y" /><span className="wt-dot-g" /></div>
        <span className="wt-title">Chrome Extension Active</span>
      </div>
      <div className="wt-content">
        {/* Extension popup mockup */}
        <div className="wt-ext-popup">
          <div className="wt-ext-header">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #5C6BC0, #7E8CF6)' }}>
                <span className="text-white text-xs font-bold">DF</span>
              </div>
              <span className="text-white text-sm font-semibold">DistractFree</span>
            </div>
            <div className="wt-status-badge">
              <motion.span
                className="wt-status-dot"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
              Active
            </div>
          </div>

          <div className="wt-ext-body">
            <div className="wt-ext-stat-row">
              <div className="wt-ext-stat">
                <span className="wt-ext-stat-label">Session</span>
                <span className="wt-ext-stat-value">25 min</span>
              </div>
              <div className="wt-ext-stat">
                <span className="wt-ext-stat-label">Elapsed</span>
                <span className="wt-ext-stat-value" style={{ color: '#7E8CF6' }}>6:18</span>
              </div>
              <div className="wt-ext-stat">
                <span className="wt-ext-stat-label">Blocked</span>
                <span className="wt-ext-stat-value" style={{ color: '#EF6B6B' }}>2</span>
              </div>
            </div>

            {/* Blocked sites list */}
            <div className="wt-ext-blocked-list">
              <span className="wt-ext-blocked-title">Blocked Sites</span>
              {['youtube.com', 'twitter.com', 'reddit.com'].map((s, i) => (
                <div key={i} className="wt-ext-blocked-item">
                  <span className="wt-ext-blocked-dot" />
                  <span>{s}</span>
                  <svg className="w-3 h-3 ml-auto text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

/* Frame 3 — Blocked Website Page */
const Frame3 = () => (
  <motion.div {...frameFade} className="wt-frame">
    <div className="wt-browser">
      <div className="wt-titlebar">
        <div className="wt-dots"><span className="wt-dot-r" /><span className="wt-dot-y" /><span className="wt-dot-g" /></div>
        <div className="wt-url-bar">
          <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>youtube.com</span>
        </div>
      </div>
      <div className="wt-content wt-blocked-page">
        <motion.div
          className="wt-blocked-icon"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 12 }}
        >
          🛡️
        </motion.div>
        <h4 className="wt-blocked-heading">Site Blocked</h4>
        <p className="wt-blocked-text">
          youtube.com is blocked during your focus session.
        </p>
        <div className="wt-blocked-timer-badge">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          18:42 remaining
        </div>
        <div className="wt-blocked-unlock">
          <span>🪙</span> Unlock for 5 coins
        </div>
      </div>
    </div>
  </motion.div>
);

/* Frame 4 — Session Complete & Coins Earned */
const Frame4 = () => (
  <motion.div {...frameFade} className="wt-frame">
    <div className="wt-browser">
      <div className="wt-titlebar">
        <div className="wt-dots"><span className="wt-dot-r" /><span className="wt-dot-y" /><span className="wt-dot-g" /></div>
        <span className="wt-title">Session Complete</span>
      </div>
      <div className="wt-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 10, delay: 0.15 }}
          className="wt-complete-check"
        >
          ✅
        </motion.div>
        <h4 className="text-white font-semibold text-base mt-3 mb-1">Focus Session Complete!</h4>
        <p className="text-gray-500 text-xs mb-4">25 minutes of focused work</p>

        {/* Coins earned card */}
        <motion.div
          className="wt-reward-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <div className="wt-reward-icon">🪙</div>
          <div>
            <p className="wt-reward-amount">+10 Focus Coins</p>
            <p className="wt-reward-detail">Base: 10 · Streak: x1.0</p>
          </div>
        </motion.div>

        {/* Streak badge */}
        <motion.div
          className="wt-streak-badge"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          🔥 3-Day Streak
        </motion.div>
      </div>
    </div>
  </motion.div>
);

/* Frame 5 — Coin Unlock / Break Panel */
const Frame5 = () => (
  <motion.div {...frameFade} className="wt-frame">
    <div className="wt-browser">
      <div className="wt-titlebar">
        <div className="wt-dots"><span className="wt-dot-r" /><span className="wt-dot-y" /><span className="wt-dot-g" /></div>
        <span className="wt-title">Unlock Break</span>
      </div>
      <div className="wt-content">
        <div className="text-center mb-4">
          <p className="text-gray-400 text-xs mb-1">Your Balance</p>
          <p className="text-white text-xl font-bold">🪙 340 <span className="text-gray-500 text-sm font-normal">coins</span></p>
        </div>

        <div className="wt-unlock-list">
          {[
            { mins: '5 min break', cost: 10, active: true },
            { mins: '15 min break', cost: 25, active: false },
            { mins: '30 min break', cost: 50, active: false },
          ].map((opt, i) => (
            <motion.div
              key={i}
              className={`wt-unlock-item ${opt.active ? 'wt-unlock-active' : ''}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
            >
              <span>{opt.mins}</span>
              <span className="wt-unlock-cost">
                <span className="wt-coin-dot" /> {opt.cost}
              </span>
            </motion.div>
          ))}
        </div>

        <motion.button
          className="wt-unlock-btn"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Unlock 5 min break · 10 coins
        </motion.button>

        <p className="text-center text-gray-600 text-[10px] mt-3">You choose when — it's always your decision</p>
      </div>
    </div>
  </motion.div>
);

/* Frame 6 — AI Insights Dashboard */
const Frame6 = () => (
  <motion.div {...frameFade} className="wt-frame">
    <div className="wt-browser">
      <div className="wt-titlebar">
        <div className="wt-dots"><span className="wt-dot-r" /><span className="wt-dot-y" /><span className="wt-dot-g" /></div>
        <span className="wt-title">AI Insights — Dashboard</span>
      </div>
      <div className="wt-content">
        {/* Summary stat cards */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Focus Score', val: '78', color: '#3FAE6A', sub: '/100' },
            { label: 'Risk Level', val: 'Low', color: '#3FAE6A', sub: '' },
            { label: 'Streak', val: '3', color: '#F5B638', sub: 'days' },
          ].map((s, i) => (
            <motion.div
              key={i}
              className="wt-dash-stat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1 }}
            >
              <span className="wt-dash-stat-label">{s.label}</span>
              <span className="wt-dash-stat-value" style={{ color: s.color }}>
                {s.val}<span className="wt-dash-stat-unit">{s.sub}</span>
              </span>
            </motion.div>
          ))}
        </div>

        {/* Mini bar chart */}
        <div className="wt-chart-container">
          <span className="wt-chart-title">Weekly Focus (hrs)</span>
          <div className="wt-chart-bars">
            {[
              { d: 'M', h: 65 }, { d: 'T', h: 80 }, { d: 'W', h: 55 },
              { d: 'T', h: 90 }, { d: 'F', h: 70 }, { d: 'S', h: 40 }, { d: 'S', h: 50 },
            ].map((bar, i) => (
              <div key={i} className="wt-chart-col">
                <motion.div
                  className="wt-chart-bar"
                  style={{ background: i === 3 ? '#7E8CF6' : '#3FAE6A' }}
                  initial={{ height: 0 }}
                  animate={{ height: `${bar.h}%` }}
                  transition={{ delay: 0.3 + i * 0.06, duration: 0.6, ease: 'easeOut' }}
                />
                <span className="wt-chart-label">{bar.d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI recommendation */}
        <motion.div
          className="wt-ai-tip"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <span>💡</span>
          <span>Your focus peaks between 9–11 AM. Schedule deep work then.</span>
        </motion.div>
      </div>
    </div>
  </motion.div>
);

const FRAMES = [Frame1, Frame2, Frame3, Frame4, Frame5, Frame6];

/* ── Rich Background System f  or Walkthrough ── */
const WalkthroughBackground = () => (
  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
    {/* Deep background gradient */}
    <div className="absolute inset-0 bg-gradient-to-b from-[#03040a] via-[#0a0c1a] to-[#03040a]" />

    {/* Noise / dot texture overlay */}
    <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

    {/* Faint ambient glow blobs */}
    <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#7b6fee] opacity-[0.04] blur-[100px]" />
    <div className="absolute bottom-[20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#00d4c8] opacity-[0.03] blur-[120px]" />

    {/* Faint UI floating silhouettes to maintain visual richness */}
    <div className="absolute top-[30%] right-[10%] w-64 h-40 border border-white/[0.02] rounded-2xl bg-white/[0.01] opacity-20 transform rotate-12" />
    <div className="absolute top-[40%] right-[15%] w-48 h-32 border border-white/[0.02] rounded-xl bg-white/[0.01] opacity-10 transform -rotate-6" />
    <div className="absolute bottom-[30%] left-[5%] w-72 h-48 border border-white/[0.03] rounded-3xl bg-white/[0.01] opacity-30 transform -rotate-12" />

    {/* Abstract line wave decoration */}
    <svg className="absolute top-[50%] left-[20%] w-[800px] h-[400px] opacity-[0.03] -translate-y-1/2" viewBox="0 0 800 400" fill="none">
      <path d="M0 200 C 200 100, 600 300, 800 200" stroke="url(#walkthrough-grad)" strokeWidth="2" />
      <path d="M0 220 C 200 120, 600 320, 800 220" stroke="url(#walkthrough-grad)" strokeWidth="1" />
      <defs>
        <linearGradient id="walkthrough-grad" x1="0" y1="0" x2="800" y2="400">
          <stop stopColor="#7b6fee" />
          <stop offset="1" stopColor="#00d4c8" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

/* ═══════════ MAIN COMPONENT ═══════════ */
const HowItWorksWalkthrough = () => {
  const [activeFrame, setActiveFrame] = useState(0);
  const containerRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const totalFrames = FRAMES.length;
    let newFrame = Math.floor(latest * totalFrames);
    if (newFrame >= totalFrames) newFrame = totalFrames - 1;
    if (newFrame < 0) newFrame = 0;

    if (newFrame !== activeFrame) {
      setActiveFrame(newFrame);
    }
  });

  const ActiveFrame = FRAMES[activeFrame];

  return (
    <section ref={containerRef} id="how-it-works" className="relative how-it-works-section" style={{ height: '300vh' }}>
      <WalkthroughBackground />
      <div className="sticky top-0 h-screen flex flex-col justify-center py-12 px-6 overflow-hidden z-10">
        <div className="max-w-6xl mx-auto w-full">

          {/* ── Header row: text left, animation right ── */}
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">

            {/* LEFT — Copy */}
            <div className="lg:col-span-5 flex flex-col justify-start pt-4">
              <p
                className="font-medium text-sm mb-3 uppercase tracking-wide section-label-upgrade"
                style={{ letterSpacing: '2px' }}
              >
                How it works
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-5 section-headline-upgrade" style={{ lineHeight: 1.15 }}>
                How DistractFree Works
              </h2>
              <p className="text-gray-400 text-[15px] leading-relaxed max-w-md mb-10">
                Scroll through the flow to see how your focus session begins, distractions get blocked, coins are earned, and insights update automatically.
              </p>


              {/* Step progress list */}
              <div className="wt-step-list">
                {STEPS.map((step, i) => (
                  <div
                    key={step.id}
                    className={`wt-step-item ${activeFrame === i ? 'wt-step-active' : ''}`}
                    style={{ cursor: 'default' }}
                  >
                    <span className={`wt-step-num ${activeFrame === i ? 'wt-step-num-active' : ''}`}>
                      {step.id}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className={`wt-step-label ${activeFrame === i ? 'text-white' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                      <AnimatePresence>
                        {activeFrame === i && (
                          <motion.p
                            className="wt-step-caption"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            {step.caption}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — Animated frame */}
            <div className="lg:col-span-7 wt-demo-container">
              {/* Glow behind frame */}
              <div className="wt-demo-glow" />

              <AnimatePresence mode="wait">
                <ActiveFrame key={activeFrame} />
              </AnimatePresence>

              {/* Monitor Stand */}
              <div className="wt-monitor-stand">
                <div className="wt-monitor-neck" />
                <div className="wt-monitor-base" />
              </div>

              {/* Animated Cursor */}
              <motion.div
                className="wt-animated-cursor"
                initial={false}
                animate={activeFrame.toString()}
                variants={{
                  '0': { left: '40%', top: '45%' }, // 25 min pill
                  '1': { left: '75%', top: '25%' }, // Extension popup
                  '2': { left: '50%', top: '65%' }, // Block page unlock
                  '3': { left: '50%', top: '50%' }, // Session complete
                  '4': { left: '35%', top: '70%' }, // 5 min break unlock
                  '5': { left: '25%', top: '35%' }, // AI stat hover
                }}
                transition={{ type: 'spring', damping: 20, stiffness: 100, mass: 0.8 }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.4))' }}>
                  <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 01.35-.15h6.42c.45 0 .67-.54.35-.85L5.85 2.86a.5.5 0 00-.85.35z" fill="white" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksWalkthrough;
