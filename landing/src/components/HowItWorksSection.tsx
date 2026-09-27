'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import BrowserFrame from './demo/BrowserFrame';
import AnimatedCursor from './demo/AnimatedCursor';
import ProductDemo, { SCENE_CURSOR_WAYPOINTS } from './demo/ProductDemo';

/* ═══════════════════════════════════════════════════════
   SCENE TIMELINE DEFINITION
   ═══════════════════════════════════════════════════════ */

interface SceneConfig {
  id: string;
  start: number;
  end: number;
  label: string;
  stepIndex: number; // which step indicator to highlight (0-5)
  url: string;
  extensionGlow?: boolean;
  typingText?: string;
}

const SCENES: SceneConfig[] = [
  {
    id: 'focus',
    start: 0,
    end: 5,
    label: 'Start Focus',
    stepIndex: 0,
    url: 'app.distractfree.com/focus',
  },
  {
    id: 'extension',
    start: 5,
    end: 10,
    label: 'Extension Activates',
    stepIndex: 1,
    url: 'app.distractfree.com',
    extensionGlow: true,
  },
  {
    id: 'distraction',
    start: 10,
    end: 14,
    label: 'Visit Instagram',
    stepIndex: 2,
    url: 'app.distractfree.com',
    typingText: 'instagram.com',
  },
  {
    id: 'blocked',
    start: 14,
    end: 20,
    label: 'Distraction Blocked',
    stepIndex: 2,
    url: 'instagram.com',
  },
  {
    id: 'return',
    start: 20,
    end: 24,
    label: 'Return to Work',
    stepIndex: 3,
    url: 'app.distractfree.com/focus',
  },
  {
    id: 'complete',
    start: 24,
    end: 29,
    label: 'Session Complete',
    stepIndex: 3,
    url: 'app.distractfree.com/focus',
  },
  {
    id: 'unlock',
    start: 29,
    end: 34,
    label: 'Intentional Unlock',
    stepIndex: 4,
    url: 'youtube.com',
  },
  {
    id: 'insights',
    start: 34,
    end: 40,
    label: 'AI Insights',
    stepIndex: 5,
    url: 'app.distractfree.com/insights',
  },
];

const TOTAL_DURATION = 42; // 40s scenes + 2s pause before loop

const STEP_LABELS = [
  { num: '01', label: 'Start Focus' },
  { num: '02', label: 'Extension Activates' },
  { num: '03', label: 'Distraction Blocked' },
  { num: '04', label: 'Earn Coins' },
  { num: '05', label: 'Unlock Intentionally' },
  { num: '06', label: 'AI Insights' },
];

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */

function getActiveScene(elapsed: number): {
  scene: SceneConfig;
  index: number;
  progress: number;
} {
  for (let i = 0; i < SCENES.length; i++) {
    const s = SCENES[i];
    if (elapsed >= s.start && elapsed < s.end) {
      return {
        scene: s,
        index: i,
        progress: (elapsed - s.start) / (s.end - s.start),
      };
    }
  }
  // In the 2s pause, stay on last scene
  return {
    scene: SCENES[SCENES.length - 1],
    index: SCENES.length - 1,
    progress: 1,
  };
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */

export default function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [manualPause, setManualPause] = useState(false);
  const elapsedRef = useRef(0);
  const [elapsedState, setElapsedState] = useState(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);

  /* ── Intersection Observer ── */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
          if (!manualPause) setIsPlaying(true);
        } else {
          setIsPlaying(false);
        }
      },
      { threshold: [0.25, 0.5] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [manualPause]);

  /* ── Animation Loop ── */
  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = 0;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      elapsedRef.current += delta;
      if (elapsedRef.current >= TOTAL_DURATION) {
        elapsedRef.current = 0;
      }

      setElapsedState(elapsedRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  /* ── Derive current scene ── */
  const { scene, index: sceneIndex, progress: sceneProgress } =
    getActiveScene(elapsedState);

  /* ── Controls ── */
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      setManualPause(true);
      setIsPlaying(false);
    } else {
      setManualPause(false);
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleReplay = useCallback(() => {
    elapsedRef.current = 0;
    setElapsedState(0);
    lastTimeRef.current = 0;
    setManualPause(false);
    setIsPlaying(true);
  }, []);

  /* ── Typing progress for Scene 2 (distraction) ── */
  const typingText =
    scene.typingText && sceneIndex === 2 ? scene.typingText : undefined;
  const typingProgress =
    typingText ? Math.min(1, sceneProgress / 0.55) : 0;

  /* ── Progress bar ── */
  const totalProgress = elapsedState / TOTAL_DURATION;

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="relative w-full py-[80px] md:py-[100px] px-4 md:px-6 bg-[#050508] overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute w-[350px] h-[350px] rounded-full bg-brand-purple/[0.04] blur-[100px] top-[15%] left-[-80px] pointer-events-none" />
      <div className="absolute w-[250px] h-[250px] rounded-full bg-brand-teal/[0.03] blur-[80px] bottom-[10%] right-[-60px] pointer-events-none" />

      <div className="max-w-[1180px] mx-auto relative">
        {/* ═══ Header ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.21, 1.02, 0.73, 1] }}
          viewport={{ once: true, margin: '-80px' }}
          className="mb-10 md:mb-14"
        >
          <p className="text-[11px] font-bold tracking-[1.8px] uppercase text-brand-purple mb-3">
            How It Works
          </p>
          <h2 className="text-[clamp(28px,4vw,48px)] font-bold tracking-[-1.5px] leading-tight text-text-primary max-w-2xl">
            Watch DistractFree in action.
          </h2>
          <p className="text-text-muted text-sm md:text-base mt-3 max-w-xl">
            A complete walkthrough of the DistractFree experience — from starting
            a focus session to earning coins and unlocking AI insights.
          </p>
        </motion.div>

        {/* ═══ Two-column Layout ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            ease: [0.21, 1.02, 0.73, 1],
            delay: 0.15,
          }}
          viewport={{ once: true, margin: '-60px' }}
          className="flex flex-col lg:flex-row gap-6 lg:gap-10"
        >
          {/* ── Left: Step Indicator ── */}
          <div className="hidden lg:flex flex-col gap-1 w-[200px] shrink-0 pt-4">
            {STEP_LABELS.map((step, i) => {
              const isActive = scene.stepIndex === i;
              const isPast = scene.stepIndex > i;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-500 ${
                    isActive
                      ? 'bg-brand-purple/[0.08] border border-brand-purple/20'
                      : 'border border-transparent'
                  }`}
                >
                  <span
                    className={`text-[10px] font-bold tracking-[1.5px] w-6 text-center transition-colors duration-500 ${
                      isActive
                        ? 'text-brand-purple'
                        : isPast
                        ? 'text-brand-purple/40'
                        : 'text-text-muted/30'
                    }`}
                  >
                    {step.num}
                  </span>
                  <span
                    className={`text-[12px] font-medium transition-colors duration-500 ${
                      isActive
                        ? 'text-text-primary'
                        : isPast
                        ? 'text-text-muted/60'
                        : 'text-text-muted/30'
                    }`}
                  >
                    {step.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="activeStep"
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-purple"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </div>
              );
            })}

            {/* Mini progress */}
            <div className="mt-4 px-3">
              <div className="w-full h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-brand-purple/60 rounded-full"
                  style={{ width: `${totalProgress * 100}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </div>
          </div>

          {/* ── Right: Browser Demo ── */}
          <div className="flex-1 min-w-0">
            {/* Mobile step indicator */}
            <div className="flex lg:hidden gap-1 mb-4 overflow-x-auto pb-2 scrollbar-none">
              {STEP_LABELS.map((step, i) => {
                const isActive = scene.stepIndex === i;
                return (
                  <div
                    key={i}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-medium transition-all duration-300 ${
                      isActive
                        ? 'bg-brand-purple/15 text-brand-purple border border-brand-purple/20'
                        : 'text-text-muted/30 border border-transparent'
                    }`}
                  >
                    {step.label}
                  </div>
                );
              })}
            </div>

            {/* Browser Frame */}
            <BrowserFrame
              url={
                typingText && typingProgress >= 1
                  ? typingText
                  : typingText
                  ? scene.url
                  : scene.url
              }
              showExtensionGlow={scene.extensionGlow}
              typingText={typingText}
              typingProgress={typingProgress}
            >
              {/* Scene content */}
              <ProductDemo
                sceneIndex={sceneIndex}
                sceneProgress={sceneProgress}
              />

              {/* Animated cursor */}
              <AnimatedCursor
                waypoints={SCENE_CURSOR_WAYPOINTS[sceneIndex] || []}
                progress={sceneProgress}
                isPlaying={isPlaying}
                sceneKey={sceneIndex}
              />
            </BrowserFrame>

            {/* ═══ Controls ═══ */}
            <div className="flex items-center justify-center gap-4 mt-5">
              {/* Play/Pause */}
              <button
                onClick={handlePlayPause}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-200 text-text-muted text-[11px] font-medium"
                aria-label={isPlaying ? 'Pause demo' : 'Play demo'}
              >
                <span className="text-xs">
                  {isPlaying ? '❚❚' : '▶'}
                </span>
                {isPlaying ? 'Pause' : 'Play'}
              </button>

              {/* Replay */}
              <button
                onClick={handleReplay}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-200 text-text-muted text-[11px] font-medium"
                aria-label="Replay demo"
              >
                <span className="text-xs">↻</span>
                Replay
              </button>

              {/* Scene label */}
              <span className="text-text-muted/40 text-[10px] font-mono hidden md:block">
                {scene.label}
              </span>
            </div>

            {/* Mobile progress bar */}
            <div className="mt-3 lg:hidden">
              <div className="w-full h-[2px] bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-purple/50 rounded-full transition-all duration-100"
                  style={{ width: `${totalProgress * 100}%` }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
