import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineFire, HiOutlineBell, HiOutlinePlay, HiOutlineStop } from 'react-icons/hi2';
import GlassCard from '../GlassCard';
import CircularProgress from '../CircularProgress';
import Button from '../Button';
import { formatTime, motivationalQuotes } from '../../utils/helpers';
import { SESSION_PRESETS, UNLOCK_COST } from '../../utils/coinRules';
import {
  T, REWARD, DEMO_USER, SESSION_SECONDS, SESSION_LABEL,
  seg, easeOut, easeInOut, inRange, sessionRemaining, sessionActive, coinBalance,
} from './demoTimeline';
import { ViewportToast } from './DeviceFrame';

/* Quotes shown on the extension's block page (extension/block.js) */
const BLOCK_QUOTES = [
  'Your future self will thank you.',
  'Stay focused. The distraction can wait.',
  'Every minute focused is progress earned.',
  'Consistency beats motivation.',
];

/* ═══════════════════════════════════════════════════════════
   APP SHELL — mirrors layouts/TopNavbar.js
   ═══════════════════════════════════════════════════════════ */
const NAV = ['Dashboard', 'Focus Session', 'Coins', 'AI Insights', 'Leaderboard', 'Settings'];

function CoinPill({ t }) {
  const balance = coinBalance(t);
  const counting = inRange(t, [T.earnCount[0] - 0.1, T.earnCount[1] + 0.7]) || inRange(t, [T.spendCount[0] - 0.1, T.spendCount[1] + 0.7]);
  return (
    <div
      data-demo-target="coin-pill"
      className={`relative flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5 transition-shadow duration-300 ${counting ? 'pd-gold-glow' : ''}`}
    >
      <span className="text-sm">🪙</span>
      <span className="text-amber-400 text-xs font-semibold tabular-nums">{balance}</span>
      <AnimatePresence>
        {inRange(t, [T.earnCount[0], T.earnCount[1] + 1]) && (
          <motion.span
            className="absolute -bottom-5 right-1 text-[11px] font-bold text-amber-300"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 2 }}
            exit={{ opacity: 0, y: 8 }}
          >
            +{REWARD.totalCoins}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function AppShell({ t, active, compact, children }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-canvas text-fg">
      <div className="pd-app-nav">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="w-7 h-7 rounded-lg" />
          <span className="text-hi font-semibold text-[14px] tracking-tight">DistractFree</span>
        </div>
        {!compact && (
          <nav className="flex items-center gap-0.5">
            {NAV.map((label) => (
              <span
                key={label}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium ${label === active ? 'bg-ink/[0.08] text-hi' : 'text-fg-2'}`}
              >
                {label}
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full px-2.5 py-1.5">
            <HiOutlineFire className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-orange-400 text-xs font-semibold">{DEMO_USER.streak}</span>
          </div>
          <CoinPill t={t} />
          {!compact && (
            <span className="p-1.5 text-fg-2">
              <HiOutlineBell className="w-[17px] h-[17px]" />
            </span>
          )}
        </div>
      </div>
      <div className="relative flex-1 min-h-0">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FOCUS SESSION — mirrors pages/FocusSession.js
   ═══════════════════════════════════════════════════════════ */
export function FocusScreen({ t, compact }) {
  const idle = t < T.startClick;
  const complete = t >= T.complete;
  const running = sessionActive(t);
  const remaining = sessionRemaining(t);
  const elapsed = SESSION_SECONDS - remaining;
  const fastForward = inRange(t, T.fastForward);
  const blockedToday = t >= T.block1In ? 1 : 0;
  const presets = SESSION_PRESETS.slice(0, 3);

  const presetHover = inRange(t, [T.presetHover - 0.1, 2.5]);
  const startHover = inRange(t, [3.05, T.startClick + 0.15]);
  const pressed = inRange(t, [T.startClick - 0.05, T.startClick + 0.12]);

  const timerCard = (
    <GlassCard padding={compact ? 'px-4 py-6' : 'px-6 py-6'} className="h-full">
      <div className="flex flex-col items-center w-full">
        <div className="flex flex-wrap justify-center gap-1.5 mb-5 min-h-[30px]">
          {fastForward ? (
            <span className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-medium bg-indigo-500/10 border border-indigo-500/25 text-indigo-200">
              <span className="pd-ff-icon">⏩</span> Fast-forward <span className="text-indigo-300/60">· {SESSION_LABEL}</span>
            </span>
          ) : presets.map((p, i) => (
            <span
              key={p.label}
              data-demo-target={i === 0 ? 'preset-25' : undefined}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 ${
                i === 0
                  ? `bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 ${presetHover ? 'scale-105' : ''}`
                  : 'bg-ink/[0.03] border border-ink/[0.06] text-fg-2'
              } ${running || complete ? 'opacity-50' : ''}`}
            >
              {p.label}
            </span>
          ))}
        </div>

        <div className="relative">
          <CircularProgress
            value={elapsed}
            max={SESSION_SECONDS}
            size={compact ? 196 : 168}
            strokeWidth={12}
            color={complete ? '#10B981' : '#7E8CF6'}
            label={complete ? '✓' : formatTime(remaining)}
            sublabel={complete ? 'Session Complete!' : running ? 'Stay focused...' : 'Ready to focus'}
          />
        </div>

        <div className="flex items-center gap-4 mt-5 h-[44px]">
          {idle && (
            <Button
              variant="primary"
              size="sm"
              tabIndex={-1}
              data-demo-target="start-focus"
              animate={{ scale: pressed ? 0.95 : startHover ? 1.04 : 1 }}
              icon={<HiOutlinePlay className="w-4 h-4" />}
            >
              Start Focus
            </Button>
          )}
          {running && (
            <Button variant="danger" size="sm" tabIndex={-1} icon={<HiOutlineStop className="w-4 h-4" />}>
              Cancel
            </Button>
          )}
          {complete && (
            <Button variant="accent" size="sm" tabIndex={-1}>
              Start Another
            </Button>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 bg-ink/[0.03] border border-ink/[0.06] rounded-full px-4 py-2">
          <span className="text-base">🪙</span>
          <span className="text-fg-2 text-[12px]">
            Earn up to <span className="text-amber-400 font-semibold">{SESSION_PRESETS[0].coins}</span> Focus Coins
          </span>
        </div>
      </div>
    </GlassCard>
  );

  return (
    <AppShell t={t} active="Focus Session" compact={compact}>
      <div className={compact ? 'p-3 h-full' : 'grid grid-cols-[1.55fr_1fr] gap-4 px-6 py-4 h-full'}>
        {timerCard}
        {!compact && (
          <div className="flex flex-col gap-4 min-h-0">
            <GlassCard padding="p-4">
              <h3 className="text-fg text-[13px] font-semibold mb-3">Live ML State</h3>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-green-500/10 text-green-400 text-xl">🎯</div>
                <div>
                  <h4 className="text-[16px] font-bold text-green-400">Focused</h4>
                  <p className="text-fg-lav text-[11px] leading-snug mt-0.5">You are perfectly in the zone. Keep going!</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard padding="p-4">
              <p className="text-fg-lav text-[10px] uppercase tracking-wider font-medium mb-2.5">Today</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { v: complete ? '25m' : `${Math.floor(elapsed / 60)}m`, l: 'Focused' },
                  { v: complete ? 1 : 0, l: 'Sessions' },
                  { v: blockedToday, l: 'Blocked', red: blockedToday > 0 },
                ].map((s) => (
                  <div key={s.l}>
                    <p className={`text-[17px] font-bold tabular-nums ${s.red ? 'text-[#EF6B6B]' : 'text-fg'}`}>{s.v}</p>
                    <p className="text-fg-lav text-[10px]">{s.l}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard padding="p-4" className="flex-1">
              <span className="text-xl">💡</span>
              <p className="text-fg-lav text-[12px] leading-relaxed italic mt-2">&ldquo;{motivationalQuotes[3]}&rdquo;</p>
              <p className="text-fg-lav/50 text-[10px] mt-2">Refreshes every minute</p>
            </GlassCard>
          </div>
        )}
      </div>

      <RewardOverlay t={t} />
    </AppShell>
  );
}

/* ── Reward popup — mirrors components/RewardPopup.js ── */
const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 7) * 0.08,
  color: ['#6366F1', '#34D399', '#818CF8', '#6EE7B7', '#A78BFA', '#F5C842'][i % 6],
  rot: (i * 53) % 360,
  drift: ((i % 5) - 2) * 14,
}));

function RewardOverlay({ t }) {
  const show = inRange(t, T.reward);
  const { baseCoins, streakMultiplier, distractionPenalty, totalCoins } = REWARD;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
        >
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="pd-confetti"
              style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s`, '--rot': `${c.rot}deg`, '--drift': `${c.drift}px` }}
            />
          ))}
          <motion.div
            className="bg-ink/15 backdrop-blur-2xl border border-ink/25 rounded-[28px] px-7 py-7 text-center w-[320px] shadow-2xl"
            initial={{ scale: 0.5, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          >
            <motion.div className="text-5xl mb-3" animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }} transition={{ duration: 0.8, delay: 0.3 }}>
              🎉
            </motion.div>
            <h2 className="text-2xl font-bold text-hi mb-1">+{totalCoins} Focus Coins</h2>
            <p className="text-fg-soft text-[13px]">Focus session completed</p>
            <p className="text-fg-2 text-[11px] mt-1 mb-4 whitespace-nowrap">
              Base {baseCoins} · Streak ×{streakMultiplier.toFixed(1)}
              {distractionPenalty > 0 && ` · −${Math.round(distractionPenalty * 100)}% distraction`}
            </p>
            <div className="flex justify-center gap-1.5 mb-1" data-demo-target="reward-coins">
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.span key={i} className="text-xl" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.1 }}>
                  🪙
                </motion.span>
              ))}
            </div>
            <span className="inline-block mt-3 bg-primary text-white text-[13px] font-semibold py-2 px-7 rounded-full">Awesome!</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════
   EXTENSION POPUP — mirrors extension/popup.html
   ═══════════════════════════════════════════════════════════ */
export function ExtensionPopup({ t, compact }) {
  const remaining = sessionRemaining(t);
  const circumference = 2 * Math.PI * 52;
  const offset = circumference * (1 - remaining / SESSION_SECONDS);
  return (
    <motion.div
      className={`pd-popup ${compact ? 'is-compact' : ''}`}
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="pd-popup-greeting">
        <p>Good evening</p>
        <b>{DEMO_USER.name}</b>
      </div>
      <div className="pd-popup-stats">
        {[
          ['🪙', coinBalance(t), 'Coins'],
          ['🔥', DEMO_USER.streak, 'Streak'],
          ['🛡️', 0, 'Blocked'],
        ].map(([icon, value, label]) => (
          <div key={label} className="pd-popup-stat">
            <span>{icon}</span>
            <b>{value}</b>
            <small>{label}</small>
          </div>
        ))}
      </div>
      <div className="pd-popup-status">
        <span>Session Status</span>
        <em>Active</em>
      </div>
      <div className="pd-popup-timer" data-demo-target="popup-timer">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" className="track" />
          <circle cx="60" cy="60" r="52" className="progress" strokeDasharray={circumference} strokeDashoffset={offset} />
        </svg>
        <div>
          <b>{formatTime(remaining)}</b>
          <small>remaining</small>
        </div>
      </div>
      <div className="pd-popup-actions">
        <span className="is-success">✓ Complete</span>
        <span className="is-danger">Cancel</span>
      </div>
      <div className="pd-popup-quick">
        <span>↻ Sync</span>
        <span>📊 Dashboard</span>
        <span className="is-danger">Logout</span>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DISTRACTING SITE — a local mock social feed
   ═══════════════════════════════════════════════════════════ */
const POSTS = [
  { user: 'travel.daily', art: 'linear-gradient(135deg,#ff9a8b,#ff6a88 45%,#ff99ac)' },
  { user: 'foodie.frames', art: 'linear-gradient(135deg,#f6d365,#fda085)' },
  { user: 'city.nights', art: 'linear-gradient(135deg,#30cfd0,#330867)' },
];

export function SocialScreen({ t, compact }) {
  const scroll = easeInOut(seg(t, T.socialIn + 0.3, T.detect + 0.3)) * (compact ? 380 : 330);
  const detect = seg(t, T.detect, T.block1In);
  const remaining = sessionRemaining(t);

  return (
    <div className="absolute inset-0 bg-black text-white overflow-hidden">
      <div className="absolute inset-0 flex" style={{ filter: `blur(${detect * 6}px)` }}>
        {!compact && (
          <aside className="w-[190px] shrink-0 border-r border-white/10 px-4 py-5">
            <p className="pd-social-logo mb-6">Instagram</p>
            {['Home', 'Search', 'Explore', 'Reels', 'Messages', 'Notifications', 'Create', 'Profile'].map((m, i) => (
              <div key={m} className={`flex items-center gap-3 py-2 text-[13px] ${i === 0 ? 'font-bold' : 'text-white/85'}`}>
                <span className={`w-[18px] h-[18px] rounded-[5px] border-2 ${i === 0 ? 'border-white bg-white/90' : 'border-white/80'}`} />
                {m}
              </div>
            ))}
          </aside>
        )}
        <main className="flex-1 flex justify-center overflow-hidden">
          <div className={compact ? 'w-full' : 'w-[400px]'} style={{ transform: `translateY(${-scroll}px)` }}>
            {compact && <p className="pd-social-logo px-3 pt-3">Instagram</p>}
            <div className="flex gap-3 px-3 py-4 overflow-hidden">
              {['you', 'maya', 'leo', 'jin', 'ava', 'sam', 'noor'].map((n, i) => (
                <div key={n} className="flex flex-col items-center gap-1 shrink-0">
                  <span className="pd-story" style={{ '--hue': `${(i * 47) % 360}deg` }} />
                  <span className="text-[10px] text-white/80">{n}</span>
                </div>
              ))}
            </div>
            {POSTS.map((p) => (
              <article key={p.user} className="border-b border-white/10 pb-3 mb-3">
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="w-7 h-7 rounded-full" style={{ background: p.art }} />
                  <span className="text-[12px] font-semibold">{p.user}</span>
                  <span className="text-[12px] text-white/50">· 2h</span>
                  <span className="ml-auto text-white/60 tracking-widest">···</span>
                </div>
                <div className="w-full aspect-square" style={{ background: p.art }} />
                <div className="flex gap-3 px-3 pt-2.5 text-[18px] leading-none">
                  <span>♡</span>
                  <span>💬</span>
                  <span>↗</span>
                  <span className="ml-auto">⌑</span>
                </div>
                <p className="px-3 pt-1.5 text-[12px] font-semibold">12,408 likes</p>
              </article>
            ))}
          </div>
        </main>
        {!compact && (
          <aside className="w-[220px] shrink-0 px-4 py-6">
            <p className="text-[12px] text-white/50 font-semibold mb-3">Suggested for you</p>
            {['design.sprint', 'nomad.notes', 'the.gymlog', 'late.snacks'].map((n, i) => (
              <div key={n} className="flex items-center gap-2 py-1.5">
                <span className="pd-story is-small" style={{ '--hue': `${(i * 83) % 360}deg` }} />
                <span className="text-[12px]">{n}</span>
                <span className="ml-auto text-[11px] text-sky-400 font-semibold">Follow</span>
              </div>
            ))}
          </aside>
        )}
      </div>

      {/* DistractFree catches the visit */}
      <div className="absolute inset-0 bg-[#0F1115] pointer-events-none" style={{ opacity: detect * 0.75 }} />
      <ViewportToast show={t >= T.detect}>
        <img src="/favicon.svg" alt="" width={18} height={18} style={{ borderRadius: 5 }} />
        <span>
          <b>instagram.com</b> is blocked <span className="pd-dim">· {formatTime(remaining)} left in session</span>
        </span>
      </ViewportToast>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   BLOCK PAGE — mirrors extension/block.html + block.css
   ═══════════════════════════════════════════════════════════ */
export function BlockScreen({ t, compact, site }) {
  const unlockFlow = site === 'youtube.com';
  const enteredAt = unlockFlow ? T.block2In : T.block1In;
  const quote = BLOCK_QUOTES[Math.floor(Math.max(0, t - enteredAt) / 1.9) % BLOCK_QUOTES.length];
  const timeLeft = sessionActive(t) ? formatTime(sessionRemaining(t)) : 'Always Blocked';

  const unlockHover = unlockFlow ? inRange(t, [31.7, T.unlockClick]) : inRange(t, T.unlockHover1);
  const returnHover = !unlockFlow && inRange(t, [18.5, T.returnClick + 0.2]);
  const unlocking = unlockFlow && inRange(t, [T.unlockClick, T.unlocked]);
  const unlocked = unlockFlow && t >= T.unlocked;
  const pressed = inRange(t, [(unlockFlow ? T.unlockClick : T.returnClick) - 0.05, (unlockFlow ? T.unlockClick : T.returnClick) + 0.12]);
  const balance = coinBalance(t);

  return (
    <div className="pd-block">
      <div className="pd-block-orb o1" />
      <div className="pd-block-orb o2" />
      <div className="pd-block-grid" />
      <div className="pd-block-ring r1" />
      <div className="pd-block-ring r2" />

      <div className={`pd-block-card ${compact ? 'is-compact' : ''}`}>
        <div className="pd-block-icon">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h1>Stay Focused</h1>
        <p className="pd-block-sub">This site is paused during your focus session.</p>

        <div className="pd-block-info">
          <div>
            <span>Website</span>
            <b>{site}</b>
          </div>
          <div>
            <span>Time Left</span>
            <b className={`pd-block-mono ${sessionActive(t) ? '' : 'is-text'}`}>{timeLeft}</b>
          </div>
        </div>

        <div className="pd-block-actions">
          <span
            data-demo-target="unlock-btn"
            className={`pd-block-btn is-unlock ${unlockHover ? 'is-hover' : ''} ${unlocked ? 'is-success' : ''} ${unlockFlow && pressed ? 'is-pressed' : ''}`}
          >
            {unlocked ? '✓ Unlocked! Redirecting…' : unlocking ? 'Unlocking…' : `🪙 Unlock for ${UNLOCK_COST} Coins`}
            {unlocked && t < T.spendCount[1] + 0.8 && <span className="pd-coin-delta">−{UNLOCK_COST}</span>}
          </span>
          {unlockFlow && (
            <span className="pd-block-balance">
              Balance <b className={inRange(t, [T.spendCount[0], T.spendCount[1] + 0.6]) ? 'pd-gold-text' : ''}>🪙 {balance}</b>
            </span>
          )}
          <span data-demo-target="return-btn" className={`pd-block-btn is-ghost ${returnHover ? 'is-hover' : ''} ${!unlockFlow && pressed ? 'is-pressed' : ''}`}>
            ← Return to Work
          </span>
        </div>

        <div className="pd-block-divider" />
        <AnimatePresence mode="wait">
          <motion.p
            key={quote}
            className="pd-block-quote"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4 }}
          >
            &ldquo;{quote}&rdquo;
          </motion.p>
        </AnimatePresence>
        <p className="pd-block-support">Every distraction resisted strengthens your focus.</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   UNLOCKED SITE — a local mock video page
   ═══════════════════════════════════════════════════════════ */
export function VideoScreen({ t, compact }) {
  const played = seg(t, T.videoIn, T.videoIn + 40);
  return (
    <div className="absolute inset-0 bg-[#0f0f0f] text-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 h-[48px]">
        <span className="text-white/70 text-lg">☰</span>
        <span className="flex items-center gap-1 font-bold tracking-tight text-[15px]">
          <span className="pd-yt-logo" /> YouTube
        </span>
        {!compact && (
          <span className="ml-auto mr-auto w-[360px] h-8 rounded-full border border-white/15 bg-[#121212] px-4 text-[12px] text-white/40 flex items-center">
            Search
          </span>
        )}
        <span className="w-7 h-7 rounded-full bg-indigo-500 text-[12px] font-bold flex items-center justify-center ml-auto">A</span>
      </div>
      <div className={compact ? 'px-0' : 'flex gap-5 px-6'}>
        <div className="flex-1 min-w-0">
          <div className="pd-player">
            <div className="pd-player-art" />
            <div className="pd-player-bar">
              <span style={{ width: `${3 + played * 100}%` }} />
            </div>
            <div className="pd-player-time">
              {formatTime(Math.floor(played * 600))} / 10:00
            </div>
          </div>
          <div className={compact ? 'px-3' : ''}>
            <h3 className="text-[15px] font-semibold mt-3">10-Minute Stretch Break for Desk Workers</h3>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600" />
              <div>
                <p className="text-[12px] font-semibold">Move Daily</p>
                <p className="text-[11px] text-white/50">412K subscribers</p>
              </div>
              <span className="ml-3 bg-white text-black text-[11px] font-semibold px-3 py-1.5 rounded-full">Subscribe</span>
            </div>
          </div>
        </div>
        <div className={compact ? 'px-3 pt-4 space-y-2.5' : 'w-[250px] shrink-0 space-y-2.5'}>
            {[
              ['linear-gradient(135deg,#667eea,#764ba2)', 'Desk yoga in 5 minutes'],
              ['linear-gradient(135deg,#f093fb,#f5576c)', 'Breathing reset for focus'],
              ['linear-gradient(135deg,#4facfe,#00f2fe)', 'Walk & think: 15 min'],
              ['linear-gradient(135deg,#43e97b,#38f9d7)', 'Posture fixes that stick'],
            ].map(([bg, title]) => (
              <div key={title} className="flex gap-2">
                <span className="w-[110px] h-[62px] rounded-lg shrink-0" style={{ background: bg }} />
                <div>
                  <p className="text-[12px] font-medium leading-snug">{title}</p>
                  <p className="text-[10px] text-white/50 mt-1">Move Daily · 1.2M views</p>
                </div>
              </div>
            ))}
        </div>
      </div>
      <ViewportToast show={inRange(t, [T.videoIn + 0.3, T.omni3Click])}>
        <img src="/favicon.svg" alt="" width={18} height={18} style={{ borderRadius: 5 }} />
        <span>
          Unlocked with coins <span className="pd-dim">· 🪙 −{UNLOCK_COST} · {coinBalance(t)} left</span>
        </span>
      </ViewportToast>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AI INSIGHTS — mirrors pages/InsightsPage.js (sample data)
   ═══════════════════════════════════════════════════════════ */
const HOURLY = [
  ['6AM', 34], ['7AM', 48], ['8AM', 66], ['9AM', 88], ['10AM', 91], ['11AM', 79], ['12PM', 57],
  ['1PM', 44], ['2PM', 29], ['3PM', 24], ['4PM', 33], ['5PM', 52], ['6PM', 61], ['7PM', 47],
];
const RISK_HOURS = [['2 PM', 64, 9], ['3 PM', 58, 7], ['4 PM', 41, 5], ['9 PM', 27, 3]];
const RECS = [
  { icon: '🌅', title: 'Protect your morning block', priority: 'high', desc: 'Schedule deep work between 9 AM and 11 AM, when your focus score is highest.', metric: '91', label: 'peak focus score' },
  { icon: '🔒', title: 'Enable Strict Mode after lunch', priority: 'medium', desc: 'Blocked-site attempts spike from 2 PM to 4 PM. Strict Mode removes the unlock option.', metric: '21', label: 'afternoon attempts' },
];
const PRIORITY = { high: '#EF6B6B', medium: '#F5B638' };
const barColor = (v) => (v >= 60 ? '#3FAE6A' : v >= 30 ? '#F5B638' : '#EF6B6B');

const Stat = ({ label, children, sub, target }) => (
  <GlassCard padding="p-3" className="text-center" data-demo-target={target}>
    <p className="text-fg-lav text-[10px] mb-0.5">{label}</p>
    {children}
    {sub && <p className="text-fg-lav text-[9px] mt-0.5">{sub}</p>}
  </GlassCard>
);

export function InsightsScreen({ t, compact }) {
  const count = easeOut(seg(t, ...T.insightsCount));
  const bars = seg(t, ...T.insightsChart);
  // Scroll to the bottom of the page (recommendations), whatever the layout height
  const viewRef = useRef(null);
  const pageRef = useRef(null);
  const [maxScroll, setMaxScroll] = useState(0);
  useLayoutEffect(() => {
    setMaxScroll(Math.max(0, pageRef.current.offsetHeight - viewRef.current.clientHeight));
  }, [compact]);
  const scroll = easeInOut(seg(t, ...T.insightsScroll)) * maxScroll;
  const n = (v) => Math.round(v * count);
  const showRecs = t >= T.insightsRecs;

  return (
    <AppShell t={t} active="AI Insights" compact={compact}>
      <div ref={viewRef} className="absolute inset-0 overflow-hidden">
        <div ref={pageRef} className={compact ? 'px-3 py-3 space-y-4' : 'px-6 py-4 space-y-5'} style={{ transform: `translateY(${-scroll}px)` }}>
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-fg font-semibold text-[16px]">🤖 AI Distraction Prediction</h2>
              <span className="pd-sample-chip">Sample data</span>
            </div>
            <div className={`grid gap-2.5 ${compact ? 'grid-cols-2' : 'grid-cols-5'}`}>
              <Stat label="Risk Level" target="insight-risk">
                <p className="font-bold text-[20px] text-[#3FAE6A]">{count > 0.4 ? 'Low' : '—'}</p>
              </Stat>
              <Stat label="Confidence" sub="High Confidence">
                <p className="text-fg font-bold text-[20px] tabular-nums">{n(82)}%</p>
              </Stat>
              <Stat label="Distraction Score">
                <p className="text-[#EF6B6B] font-bold text-[20px] tabular-nums">
                  {n(24)}<span className="text-[11px] text-fg-lav">/100</span>
                </p>
              </Stat>
              <Stat label="Focus Score" sub="(Based on 7-day avg)">
                <p className="text-[#3FAE6A] font-bold text-[20px] tabular-nums">
                  {n(78)}<span className="text-[11px] text-fg-lav">/100</span>
                </p>
              </Stat>
              {!compact && (
                <Stat label="Sessions" sub="Completed">
                  <p className="text-fg font-bold text-[20px] tabular-nums">
                    {n(18)}<span className="text-[11px] text-fg-lav">/{n(21)}</span>
                  </p>
                </Stat>
              )}
            </div>
            <GlassCard padding="p-3" className="border-indigo-500/20 mt-2.5">
              <div className="flex items-start gap-2.5">
                <span>💡</span>
                <p className="text-fg-soft text-[12px] leading-relaxed">
                  Your strongest productivity period is <b className="text-fg">9 AM – 11 AM</b>. Scheduling deep work there is likely to keep your
                  distraction score low.
                </p>
              </div>
            </GlassCard>
          </section>

          <section>
            <h2 className="text-fg font-semibold text-[16px] mb-3">📈 Focus Pattern Analysis</h2>
            <div className={`grid gap-2.5 mb-2.5 ${compact ? 'grid-cols-2' : 'grid-cols-4'}`}>
              <Stat label="Best Focus Hours" target="insight-best-hours">
                <p className="text-fg font-bold text-[15px]">9 AM – 11 AM</p>
              </Stat>
              <Stat label="High Distraction Hours">
                <p className="text-[#F5B638] font-bold text-[15px]">2 PM – 4 PM</p>
              </Stat>
              <Stat label="Avg Session">
                <p className="text-fg font-bold text-[15px]">{n(31)} min</p>
              </Stat>
              <Stat label="Optimal Length">
                <p className="text-[#7C5CFC] font-bold text-[15px]">35 min</p>
              </Stat>
            </div>
            <GlassCard padding="p-3">
              <p className="text-fg-lav text-[10px] mb-2 font-medium uppercase tracking-wider">Hourly Focus Score</p>
              <div className="flex items-end gap-[5px] h-[92px]">
                {HOURLY.slice(0, compact ? 10 : HOURLY.length).map(([label, v], i) => (
                  <div key={label} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div
                      className="w-full rounded-t-[4px]"
                      style={{ height: `${v * easeOut(seg(bars, i * 0.03, 0.6 + i * 0.03))}%`, background: barColor(v), opacity: 0.8 }}
                    />
                    <span className="text-[8px] text-fg-4 mt-1">{label}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </section>

          <section>
            <h2 className="text-fg font-semibold text-[16px] mb-3">📉 High Risk Distraction Hours</h2>
            <div className={`grid gap-2.5 mb-2.5 ${compact ? 'grid-cols-2' : 'grid-cols-4'}`}>
              {RISK_HOURS.map(([label, risk, attempts]) => (
                <GlassCard key={label} padding="p-3" className="text-center">
                  <CircularProgress value={risk} max={100} size={64} strokeWidth={6} color={risk > 60 ? '#EF6B6B' : risk > 30 ? '#F5B638' : '#3FAE6A'} />
                  <p className="text-fg text-[12px] font-medium mt-1.5">
                    {label} · {risk}%
                  </p>
                  <p className="text-fg-lav text-[9px]">{attempts} blocked attempts</p>
                </GlassCard>
              ))}
            </div>
            <GlassCard padding="p-3" className="border-red-500/10">
              <p className="text-fg-soft text-[12px] text-center">
                <span className="text-[#EF6B6B] font-medium">AI Analysis:</span> Your distraction risk tends to increase between{' '}
                <span className="text-fg font-semibold">2 PM – 4 PM</span>.
              </p>
            </GlassCard>
          </section>

          <section>
            <h2 className="text-fg font-semibold text-[16px] mb-3">🧠 Personalized Recommendations</h2>
            <div className={`grid gap-2.5 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {RECS.map((rec, i) => (
                <motion.div
                  key={rec.title}
                  initial={false}
                  animate={{ opacity: showRecs ? 1 : 0, x: showRecs ? 0 : i % 2 === 0 ? -15 : 15 }}
                  transition={{ delay: showRecs ? i * 0.15 : 0, duration: 0.4 }}
                >
                  <GlassCard padding="p-3.5" className="h-full" data-demo-target={i === 0 ? 'insight-rec' : undefined}>
                    <div className="flex gap-3">
                      <span className="text-xl">{rec.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-fg font-semibold text-[12px]">{rec.title}</h3>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${PRIORITY[rec.priority]}20`, color: PRIORITY[rec.priority] }}>
                            {rec.priority}
                          </span>
                        </div>
                        <p className="text-fg-lav text-[11px] leading-relaxed mb-1.5">{rec.desc}</p>
                        <span className="text-[#7C5CFC] text-[11px] font-bold">{rec.metric}</span>{' '}
                        <span className="text-fg-4 text-[10px]">{rec.label}</span>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
