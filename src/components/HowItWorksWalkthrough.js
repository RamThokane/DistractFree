import React, { useRef, useState } from 'react';
import { MotionConfig, useInView, useReducedMotion } from 'framer-motion';
import ProductDemo from './demo/ProductDemo';
import useDemoClock, { usePageVisible } from './demo/useDemoClock';
import { STEPS, TOTAL_DURATION, seg } from './demo/demoTimeline';

/* ═══════════════════════════════════════════════════════════
   HowItWorksWalkthrough — autoplaying product demo
   The demo runs on its own clock like a video. Scrolling the
   page never drives it; visibility only starts / pauses it.
   ═══════════════════════════════════════════════════════════ */

const formatClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ── Rich Background System for Walkthrough ── */
const WalkthroughBackground = () => (
  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 bg-gradient-to-b from-[#03040a] via-[#0a0c1a] to-[#03040a]" />
    <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
    <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#7b6fee] opacity-[0.04] blur-[100px]" />
    <div className="absolute bottom-[10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#00d4c8] opacity-[0.03] blur-[120px]" />
  </div>
);

const PlayIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
    <path d="M2 1l7 4-7 4z" />
  </svg>
);
const PauseIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
    <rect x="1.5" y="1" width="2.5" height="8" rx="0.5" />
    <rect x="6" y="1" width="2.5" height="8" rx="0.5" />
  </svg>
);

const HowItWorksWalkthrough = () => {
  const demoRef = useRef(null);
  const inView = useInView(demoRef, { amount: 0.35 });
  const pageVisible = usePageVisible();
  const reduced = useReducedMotion();
  const [userPaused, setUserPaused] = useState(false);

  const playing = inView && pageVisible && !userPaused;
  const { time, t, restart } = useDemoClock(TOTAL_DURATION, playing);

  const replay = () => {
    restart();
    setUserPaused(false);
  };

  return (
    <MotionConfig reducedMotion="user">
      <section id="how-it-works" className="relative how-it-works-section py-24 px-6 overflow-hidden">
        <WalkthroughBackground />

        <div className="relative z-10 max-w-[1040px] mx-auto">
          <div className="text-center mb-10">
            <p className="font-medium text-sm mb-3 uppercase tracking-wide section-label-upgrade" style={{ letterSpacing: '2px' }}>
              How it works
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-hi section-headline-upgrade" style={{ lineHeight: 1.15 }}>
              How DistractFree Works
            </h2>
          </div>

          {/* Sized from the viewport height so the whole computer + controls fit on screen */}
          <div ref={demoRef} className="min-w-0 mx-auto" style={{ maxWidth: 'min(880px, max(560px, calc(160vh - 400px)))' }}>
            <ProductDemo t={t} time={time} reduced={reduced} />

            {/* Playback controls */}
            <div className="hiw-controls">
              <button type="button" className="hiw-btn" onClick={() => setUserPaused((p) => !p)} aria-label={playing ? 'Pause demo' : 'Play demo'}>
                {playing ? <PauseIcon /> : <PlayIcon />}
                {playing ? 'Pause' : 'Play'}
              </button>
              <div className="hiw-track" aria-hidden="true">
                {STEPS.map((s) => (
                  <span key={s.num} style={{ flexGrow: s.end - s.start }}>
                    <i style={{ transform: `scaleX(${seg(t, s.start, s.end)})` }} />
                  </span>
                ))}
              </div>
              <span className="hiw-time">
                {formatClock(t)} / {formatClock(TOTAL_DURATION)}
              </span>
              <button type="button" className="hiw-btn" onClick={replay} aria-label="Replay demo from the start">
                ↻<span className="hidden sm:inline">Replay</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
};

export default HowItWorksWalkthrough;
