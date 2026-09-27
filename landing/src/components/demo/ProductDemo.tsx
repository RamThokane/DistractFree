'use client';

import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CursorWaypoint } from './AnimatedCursor';

/* ═══════════════════════════════════════════════════════
   SHARED HELPERS
   ═══════════════════════════════════════════════════════ */

function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function DemoTimerRing({
  progress = 0,
  size = 160,
  strokeWidth = 10,
  color = '#7E8CF6',
  label,
  sublabel,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label: string;
  sublabel: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - Math.min(1, progress) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow: `0 0 ${size * 0.12}px ${color}22, 0 0 ${size * 0.25}px ${color}11`,
        }}
      />
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(124,92,252,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.4s ease-out',
            filter: `drop-shadow(0 0 5px ${color}66)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[clamp(18px,2.5vw,26px)] font-bold text-[#F0EEFF] tabular-nums">
          {label}
        </span>
        <span className="text-[clamp(8px,1vw,11px)] text-[#8B8AA8] mt-0.5">
          {sublabel}
        </span>
      </div>
    </div>
  );
}

function DemoGlassCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-[rgba(15,19,41,0.55)] backdrop-blur-xl border border-[rgba(124,92,252,0.1)] rounded-2xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.03)] ${className}`}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(124,92,252,0.15)] to-transparent" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SCENE 1: FOCUS SESSION
   ═══════════════════════════════════════════════════════ */

const FocusSessionScene = memo(function FocusSessionScene({
  progress,
}: {
  progress: number;
}) {
  const hasClicked = progress > 0.4;
  const afterClick = hasClicked ? (progress - 0.4) / 0.6 : 0;
  const timerSeconds = hasClicked
    ? 25 * 60 - Math.floor(afterClick * 32)
    : 25 * 60;
  const ringProgress = hasClicked ? afterClick * 0.022 : 0;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 md:p-6">
      {/* Focus Mode Active badge */}
      <AnimatePresence>
        {hasClicked && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="mb-3 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-[10px] font-semibold">
              Focus Mode Active
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session presets */}
      <div className="flex flex-wrap justify-center gap-1.5 mb-4">
        {['25 min (Pomodoro)', '50 min', '90 min'].map((label, i) => (
          <div
            key={label}
            className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-opacity ${
              i === 0
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white/[0.03] border border-white/[0.06] text-gray-500'
            } ${hasClicked ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Timer ring */}
      <DemoTimerRing
        progress={ringProgress}
        size={140}
        strokeWidth={10}
        color={hasClicked ? '#7E8CF6' : '#7E8CF6'}
        label={formatTimer(timerSeconds)}
        sublabel={hasClicked ? 'Stay focused...' : 'Ready to focus'}
      />

      {/* Start button or status */}
      <div className="mt-4">
        {!hasClicked ? (
          <div
            id="demo-start-focus"
            className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl font-medium text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            <svg
              className="w-3.5 h-3.5 fill-current"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            Start Focus
          </div>
        ) : (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-300 text-[10px] font-medium"
          >
            🎯 Focusing — 25 min session
          </motion.div>
        )}
      </div>

      {/* Coins badge */}
      <div className="mt-3 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-full flex items-center gap-1.5 text-[10px] text-gray-400">
        🪙 Earn up to{' '}
        <span className="text-amber-400 font-semibold">10</span> Focus Coins
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════
   SCENE 2: EXTENSION ACTIVATES
   ═══════════════════════════════════════════════════════ */

const ExtensionScene = memo(function ExtensionScene({
  progress,
}: {
  progress: number;
}) {
  const popupVisible = progress > 0.2;

  return (
    <div className="absolute inset-0">
      {/* Background: focus session running (dimmed) */}
      <div className="absolute inset-0 opacity-30 scale-[0.92] origin-top-left">
        <div className="p-6 flex flex-col items-center justify-center h-full">
          <div className="mb-3 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-[10px] font-semibold">
              Focus Mode Active
            </span>
          </div>
          <DemoTimerRing
            progress={0.02}
            size={120}
            label="24:32"
            sublabel="Stay focused..."
          />
        </div>
      </div>

      {/* Extension popup */}
      <AnimatePresence>
        {popupVisible && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.21, 1.02, 0.73, 1] }}
            className="absolute top-3 right-3 w-[220px] md:w-[250px] bg-[#0c0e14] border border-[#252a3a] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            {/* Popup header */}
            <div className="px-3 py-2 border-b border-[#252a3a]">
              <p className="text-[9px] text-[#6b7094] uppercase tracking-wide">
                Good evening
              </p>
              <p className="text-[13px] font-bold text-[#ebedf2]">User</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-1 p-2">
              {[
                { icon: '🪙', value: '340', label: 'Coins' },
                { icon: '🔥', value: '7', label: 'Streak' },
                { icon: '🛡️', value: '12', label: 'Blocked' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center gap-0.5 bg-[#1a1d28] border border-[#252a3a] rounded-lg p-2"
                >
                  <span className="text-sm">{stat.icon}</span>
                  <span className="text-xs font-extrabold text-[#ebedf2]">
                    {stat.value}
                  </span>
                  <span className="text-[8px] text-[#6b7094] uppercase font-semibold tracking-wide">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Status */}
            <div className="mx-2 mb-2 bg-[#1c2540] border border-[#3b82f6] rounded-lg p-2 flex justify-between items-center shadow-[0_0_16px_rgba(59,130,246,0.12)]">
              <span className="text-[10px] text-[#6b7094] font-medium">
                Session Status
              </span>
              <motion.span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[rgba(59,130,246,0.15)] text-[#60a5fa] uppercase tracking-wide"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Active
              </motion.span>
            </div>

            {/* Mini timer */}
            <div className="flex flex-col items-center pb-3">
              <div className="relative w-16 h-16">
                <svg viewBox="0 0 120 120" className="w-full h-full">
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="#252a3a"
                    strokeWidth="5"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray="326.7"
                    strokeDashoffset="10"
                    style={{
                      filter: 'drop-shadow(0 0 4px rgba(59,130,246,0.4))',
                      transform: 'rotate(-90deg)',
                      transformOrigin: 'center',
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[11px] font-extrabold text-[#ebedf2] tabular-nums">
                    24:32
                  </span>
                  <span className="text-[7px] text-[#6b7094] uppercase">
                    remaining
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════
   SCENE 3: DISTRACTION (typing instagram.com)
   ═══════════════════════════════════════════════════════ */

const DistractionScene = memo(function DistractionScene({
  progress,
}: {
  progress: number;
}) {
  const loadingVisible = progress > 0.6;

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Simulated Instagram-like page loading */}
      {!loadingVisible ? (
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-amber-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </div>
            <p className="text-gray-400 text-xs">Loading instagram.com...</p>
          </motion.div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 p-4"
        >
          {/* Simulated IG feed */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.06]">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-amber-500" />
            <span className="text-[11px] font-semibold text-white/80">
              Instagram
            </span>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-white/[0.06] shrink-0" />
                <div className="flex-1 space-y-1">
                  <div
                    className="h-2 bg-white/[0.06] rounded"
                    style={{ width: `${70 - i * 15}%` }}
                  />
                  <div className="h-20 bg-white/[0.04] rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════
   BLOCK PAGE (shared by scenes 4 & 7)
   ═══════════════════════════════════════════════════════ */

const MOTIVATIONAL_QUOTES = [
  'Discipline is choosing what you want most over what you want now.',
  'Small focus sessions create big results.',
  'Your future self will thank you.',
  'Focus is a superpower in a distracted world.',
  'Consistency beats motivation.',
];

const BlockPageDemo = memo(function BlockPageDemo({
  progress,
  siteName,
  timeRemaining,
  showUnlockAction,
  coinBalance,
}: {
  progress: number;
  siteName: string;
  timeRemaining: string;
  showUnlockAction?: boolean;
  coinBalance?: number;
}) {
  const unlockClicked = showUnlockAction && progress > 0.55;
  const quoteIndex = Math.floor(progress * 2) % MOTIVATIONAL_QUOTES.length;

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      {/* Ambient orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-[250px] h-[250px] rounded-full bg-[rgba(92,107,192,0.12)] blur-[60px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[280px] h-[280px] rounded-full bg-[rgba(139,92,246,0.08)] blur-[60px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[320px] bg-[rgba(26,30,36,0.75)] backdrop-blur-2xl border border-white/[0.06] rounded-2xl p-5 text-center shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative"
      >
        {/* Top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-[rgba(126,140,246,0.3)] to-transparent" />

        {/* Shield icon */}
        <div className="w-12 h-12 mx-auto mb-3 bg-[rgba(126,140,246,0.15)] border border-[rgba(126,140,246,0.2)] rounded-full flex items-center justify-center text-[#7E8CF6]">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>

        <h3 className="text-base font-bold text-white mb-1">Stay Focused</h3>
        <p className="text-[11px] text-[#9CA3AF] mb-4">
          This website is paused during your focus session.
        </p>

        {/* Info */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 mb-4">
          <div className="flex justify-between items-center py-1.5 border-b border-white/[0.06]">
            <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-medium">
              Website
            </span>
            <span className="text-[11px] text-white font-semibold">
              {siteName}
            </span>
          </div>
          <div className="flex justify-between items-center py-1.5">
            <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-medium">
              Time Left
            </span>
            <span className="text-[12px] text-[#7E8CF6] font-mono font-bold tracking-wider">
              {timeRemaining}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mb-4">
          {showUnlockAction ? (
            <div
              className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${
                unlockClicked
                  ? 'bg-[rgba(16,185,129,0.2)] text-[#6EE7B7] border border-[rgba(16,185,129,0.3)] shadow-[0_4px_16px_rgba(16,185,129,0.12)]'
                  : 'bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.08))] text-[#FCD34D] border border-[rgba(245,158,11,0.2)]'
              }`}
            >
              {unlockClicked ? '✓ Unlocked! Redirecting…' : '🪙 Unlock for 5 Coins'}
            </div>
          ) : (
            <div className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.08))] text-[#FCD34D] border border-[rgba(245,158,11,0.2)]">
              🪙 Unlock for 5 Coins
            </div>
          )}
          <div className="w-full py-2.5 rounded-xl text-xs font-medium bg-white/[0.03] text-[#9CA3AF] border border-white/[0.06]">
            ← Return to Google
          </div>
        </div>

        {/* Coin balance (for unlock scene) */}
        {showUnlockAction && coinBalance !== undefined && (
          <div className="flex items-center justify-center gap-1.5 mb-3 text-[10px] text-gray-400">
            🪙{' '}
            <span className="text-amber-400 font-bold tabular-nums">
              {unlockClicked ? coinBalance - 5 : coinBalance}
            </span>{' '}
            coins remaining
          </div>
        )}

        {/* Divider */}
        <div className="w-8 h-px bg-gradient-to-r from-transparent via-[rgba(126,140,246,0.3)] to-transparent mx-auto mb-3" />

        {/* Quote */}
        <p className="text-[10px] italic text-[rgba(165,180,252,0.7)] leading-relaxed max-w-[240px] mx-auto">
          &ldquo;{MOTIVATIONAL_QUOTES[quoteIndex]}&rdquo;
        </p>
      </motion.div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════
   SCENE 5: RETURN TO WORK
   ═══════════════════════════════════════════════════════ */

const ReturnToWorkScene = memo(function ReturnToWorkScene({
  progress,
}: {
  progress: number;
}) {
  const timerSeconds = 18 * 60 - Math.floor(progress * 15);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 md:p-6">
      {/* Focus Mode Active badge */}
      <div className="mb-3 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-green-400 text-[10px] font-semibold">
          Focus Mode Active
        </span>
      </div>

      {/* Presets (dimmed) */}
      <div className="flex gap-1.5 mb-4 opacity-50">
        <div className="px-3 py-1.5 bg-indigo-500 text-white rounded-full text-[10px] font-medium">
          25 min (Pomodoro)
        </div>
      </div>

      {/* Timer */}
      <DemoTimerRing
        progress={0.28}
        size={140}
        label={formatTimer(timerSeconds)}
        sublabel="Stay focused..."
      />

      {/* Status */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-4 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-300 text-[10px] font-medium"
      >
        🎯 Focusing — 25 min session
      </motion.div>

      <div className="mt-3 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-full flex items-center gap-1.5 text-[10px] text-gray-400">
        🪙 Earn up to{' '}
        <span className="text-amber-400 font-semibold">10</span> Focus Coins
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════
   SCENE 6: SESSION COMPLETE + COINS
   ═══════════════════════════════════════════════════════ */

const SessionCompleteScene = memo(function SessionCompleteScene({
  progress,
}: {
  progress: number;
}) {
  const showComplete = progress > 0.15;
  const showCoins = progress > 0.35;
  const showStreak = progress > 0.55;

  // Animated coin counter: 340 → 350
  const coinProgress = showCoins
    ? Math.min(1, (progress - 0.35) / 0.35)
    : 0;
  const coinCount = Math.floor(340 + coinProgress * 10);

  // Timer countdown effect
  const timerSeconds = showComplete ? 0 : Math.max(0, 30 - Math.floor(progress * 200));

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 md:p-6">
      {/* Timer ring — fills to 100% green */}
      <DemoTimerRing
        progress={showComplete ? 1 : 0.95 + progress * 0.05}
        size={130}
        color={showComplete ? '#10B981' : '#7E8CF6'}
        label={showComplete ? '✓' : formatTimer(timerSeconds)}
        sublabel={showComplete ? 'Session Complete!' : 'Almost there...'}
      />

      {/* Coins reward */}
      <AnimatePresence>
        {showCoins && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="mt-4 flex flex-col items-center"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <motion.span
                className="text-lg"
                animate={{ rotateY: [0, 360] }}
                transition={{ duration: 1, ease: 'easeInOut' }}
              >
                🪙
              </motion.span>
              <span className="text-amber-400 font-bold text-sm">
                +10 Focus Coins
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
              Balance:{' '}
              <span className="text-amber-400 font-bold tabular-nums">
                {coinCount}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streak */}
      <AnimatePresence>
        {showStreak && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-3"
          >
            <motion.div
              className="px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center gap-1.5"
              animate={{
                boxShadow: [
                  '0 0 0 rgba(249,115,22,0)',
                  '0 0 16px rgba(249,115,22,0.15)',
                  '0 0 0 rgba(249,115,22,0)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="text-sm">🔥</span>
              <span className="text-orange-400 text-[10px] font-bold">
                8 Day Streak
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start another button */}
      <AnimatePresence>
        {progress > 0.75 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 px-5 py-2 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-[10px] font-medium"
          >
            Start Another
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════
   SCENE 8: AI INSIGHTS
   ═══════════════════════════════════════════════════════ */

const AIInsightsScene = memo(function AIInsightsScene({
  progress,
}: {
  progress: number;
}) {
  const valueProgress = Math.min(1, progress / 0.5);
  const eased = valueProgress < 0.5
    ? 2 * valueProgress * valueProgress
    : 1 - Math.pow(-2 * valueProgress + 2, 2) / 2;

  const focusScore = Math.floor(78 * eased);
  const distractionScore = Math.floor(22 * eased);
  const confidence = Math.floor(87 * eased);

  const showRecommendation = progress > 0.45;
  const showChart = progress > 0.25;

  return (
    <div className="absolute inset-0 overflow-y-auto p-3 md:p-4">
      {/* Header */}
      <h3 className="text-[#F0EEFF] font-semibold text-[13px] mb-3 flex items-center gap-1.5">
        🤖 AI Distraction Prediction
      </h3>

      {/* Score cards */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {[
          {
            label: 'Risk Level',
            value: eased > 0.5 ? 'Low' : '—',
            color: '#3FAE6A',
          },
          {
            label: 'Confidence',
            value: `${confidence}%`,
            color: '#F0EEFF',
          },
          {
            label: 'Distraction',
            value: `${distractionScore}`,
            color: '#EF6B6B',
            suffix: '/100',
          },
          {
            label: 'Focus Score',
            value: `${focusScore}`,
            color: '#3FAE6A',
            suffix: '/100',
          },
        ].map((card) => (
          <DemoGlassCard key={card.label} className="text-center !p-2">
            <p className="text-[#8B8AA8] text-[7px] mb-0.5 uppercase tracking-wider">
              {card.label}
            </p>
            <p
              className="font-bold text-sm tabular-nums"
              style={{ color: card.color }}
            >
              {card.value}
              {card.suffix && (
                <span className="text-[8px] text-[#8B8AA8]">
                  {card.suffix}
                </span>
              )}
            </p>
          </DemoGlassCard>
        ))}
      </div>

      {/* Explanation */}
      <DemoGlassCard className="!p-2.5 mb-3 border-indigo-500/15">
        <div className="flex items-start gap-2">
          <span className="text-sm shrink-0">💡</span>
          <p className="text-[#C4C1E0] text-[9px] leading-relaxed">
            Your strongest focus period is between{' '}
            <strong className="text-[#F0EEFF]">9 AM and 11 AM</strong>.
            Consider scheduling deep work during this window for maximum
            productivity.
          </p>
        </div>
      </DemoGlassCard>

      {/* Hourly bar chart (CSS) */}
      <AnimatePresence>
        {showChart && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <DemoGlassCard className="!p-2.5 mb-3">
              <p className="text-[#8B8AA8] text-[7px] mb-2 font-medium uppercase tracking-wider">
                Hourly Focus Score
              </p>
              <div className="flex items-end gap-[3px] h-14">
                {[30, 45, 72, 85, 90, 78, 65, 55, 40, 35, 50, 60].map(
                  (val, i) => {
                    const barProgress = Math.min(
                      1,
                      (progress - 0.25) / 0.4
                    );
                    const height = val * barProgress;
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-t-[2px] transition-all duration-500"
                        style={{
                          height: `${height}%`,
                          backgroundColor:
                            val >= 60
                              ? 'rgba(63,174,106,0.7)'
                              : val >= 30
                              ? 'rgba(245,182,56,0.7)'
                              : 'rgba(239,107,107,0.7)',
                        }}
                      />
                    );
                  }
                )}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[6px] text-[#6B6A85]">6AM</span>
                <span className="text-[6px] text-[#6B6A85]">12PM</span>
                <span className="text-[6px] text-[#6B6A85]">6PM</span>
              </div>
            </DemoGlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recommendation */}
      <AnimatePresence>
        {showRecommendation && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <DemoGlassCard className="!p-2.5">
              <div className="flex gap-2">
                <span className="text-base shrink-0">⏱️</span>
                <div>
                  <h4 className="text-[#F0EEFF] font-semibold text-[10px] mb-0.5">
                    Recommended Session Time
                  </h4>
                  <p className="text-[#8B8AA8] text-[8px] leading-relaxed">
                    Based on your patterns, try a{' '}
                    <strong className="text-[#F0EEFF]">35-minute</strong>{' '}
                    session followed by a{' '}
                    <strong className="text-[#F0EEFF]">7-minute</strong> break.
                  </p>
                </div>
              </div>
            </DemoGlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════
   CURSOR WAYPOINTS PER SCENE
   ═══════════════════════════════════════════════════════ */

export const SCENE_CURSOR_WAYPOINTS: Record<number, CursorWaypoint[]> = {
  0: [
    // Focus Session
    { atProgress: 0, x: 55, y: 35 },
    { atProgress: 0.25, x: 50, y: 73 },
    { atProgress: 0.4, x: 50, y: 73, click: true },
    { atProgress: 0.7, x: 45, y: 40 },
    { atProgress: 1, x: 48, y: 42 },
  ],
  1: [
    // Extension
    { atProgress: 0, x: 50, y: 30 },
    { atProgress: 0.15, x: 88, y: 5 },
    { atProgress: 0.2, x: 88, y: 5, click: true },
    { atProgress: 0.45, x: 78, y: 35 },
    { atProgress: 0.7, x: 75, y: 50 },
    { atProgress: 1, x: 72, y: 42 },
  ],
  2: [
    // Distraction (typing)
    { atProgress: 0, x: 50, y: 15 },
    { atProgress: 0.15, x: 50, y: 3 },
    { atProgress: 0.6, x: 50, y: 3 },
    { atProgress: 0.8, x: 50, y: 45 },
    { atProgress: 1, x: 50, y: 50 },
  ],
  3: [
    // Block page
    { atProgress: 0, x: 50, y: 35 },
    { atProgress: 0.3, x: 50, y: 70 },
    { atProgress: 0.6, x: 50, y: 75 },
    { atProgress: 0.8, x: 50, y: 78 },
    { atProgress: 1, x: 50, y: 78 },
  ],
  4: [
    // Return to work
    { atProgress: 0, x: 50, y: 78 },
    { atProgress: 0.1, x: 50, y: 78, click: true },
    { atProgress: 0.4, x: 48, y: 45 },
    { atProgress: 1, x: 46, y: 40 },
  ],
  5: [
    // Session complete
    { atProgress: 0, x: 50, y: 35 },
    { atProgress: 0.3, x: 52, y: 42 },
    { atProgress: 0.5, x: 55, y: 58 },
    { atProgress: 0.8, x: 55, y: 65 },
    { atProgress: 1, x: 50, y: 55 },
  ],
  6: [
    // Unlock
    { atProgress: 0, x: 50, y: 35 },
    { atProgress: 0.3, x: 50, y: 56 },
    { atProgress: 0.5, x: 50, y: 56, click: true },
    { atProgress: 0.7, x: 50, y: 60 },
    { atProgress: 1, x: 50, y: 50 },
  ],
  7: [
    // AI Insights
    { atProgress: 0, x: 25, y: 12 },
    { atProgress: 0.25, x: 65, y: 15 },
    { atProgress: 0.5, x: 50, y: 45 },
    { atProgress: 0.75, x: 45, y: 65 },
    { atProgress: 1, x: 50, y: 55 },
  ],
};

/* ═══════════════════════════════════════════════════════
   MAIN PRODUCT DEMO RENDERER
   ═══════════════════════════════════════════════════════ */

interface ProductDemoProps {
  sceneIndex: number;
  sceneProgress: number;
}

export default function ProductDemo({
  sceneIndex,
  sceneProgress,
}: ProductDemoProps) {
  const scenes: Record<number, React.ReactNode> = {
    0: <FocusSessionScene progress={sceneProgress} />,
    1: <ExtensionScene progress={sceneProgress} />,
    2: <DistractionScene progress={sceneProgress} />,
    3: (
      <BlockPageDemo
        progress={sceneProgress}
        siteName="instagram.com"
        timeRemaining="22:15"
      />
    ),
    4: <ReturnToWorkScene progress={sceneProgress} />,
    5: <SessionCompleteScene progress={sceneProgress} />,
    6: (
      <BlockPageDemo
        progress={sceneProgress}
        siteName="youtube.com"
        timeRemaining="Always Blocked"
        showUnlockAction
        coinBalance={350}
      />
    ),
    7: <AIInsightsScene progress={sceneProgress} />,
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={sceneIndex}
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        {scenes[sceneIndex] || null}
      </motion.div>
    </AnimatePresence>
  );
}
