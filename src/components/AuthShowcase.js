import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiShield, FiTrendingUp, FiUnlock } from 'react-icons/fi';
import { SESSION_PRESETS, UNLOCK_COST } from '../utils/coinRules';
import { formatTime } from '../utils/helpers';

/* ═══════════════════════════════════════════════════════════
   AuthShowcase — right-hand panel of the login / register pages
   ═══════════════════════════════════════════════════════════ */

const SESSION = SESSION_PRESETS[0];
const BLOCKED_SITES = ['instagram.com', 'youtube.com', 'x.com'];

const FEATURES = [
  { icon: FiShield, title: 'Blocks distractions', text: 'The extension pauses blocked sites mid-session.', color: '#7E8CF6' },
  { icon: FiUnlock, title: 'Breaks you earn', text: `Spend ${UNLOCK_COST} coins to unlock a site on purpose.`, color: '#F5B638' },
  { icon: FiTrendingUp, title: 'AI insights', text: 'Learn when you focus best and when you drift.', color: '#3FAE6A' },
];

const rise = (delay) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: [0.21, 1.02, 0.73, 1], delay },
});

/* Live countdown so the card feels like a running session */
function useCountdown(start) {
  const [left, setLeft] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s <= 1 ? start : s - 1)), 1000);
    return () => clearInterval(id);
  }, [start]);
  return left;
}

function SessionCard() {
  const left = useCountdown(SESSION.seconds - 1);
  const size = 132;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = 1 - left / SESSION.seconds;

  return (
    <div className="relative w-full rounded-[22px] bg-surface-2/90 border border-ink/[0.07] shadow-[0_30px_60px_rgba(0,0,0,0.55)] light:shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />

      <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink/[0.05]">
        <div className="flex items-center gap-2">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
            <span className="relative w-2 h-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[13px] font-medium text-hi">Focus session in progress</span>
        </div>
        <span className="text-[11px] text-fg-2">{SESSION.label}</span>
      </div>

      <div className="flex items-center gap-6 px-5 py-5">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(124,92,252,0.1)" strokeWidth={stroke} />
            <circle
              cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#7E8CF6" strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 1s linear', filter: 'drop-shadow(0 0 6px rgba(126,140,246,0.5))' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[26px] font-bold text-hi tabular-nums tracking-tight">{formatTime(left)}</span>
            <span className="text-[11px] text-fg-2">Stay focused…</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-fg-2 font-medium mb-2">Blocked this session</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {BLOCKED_SITES.map((site) => (
              <span key={site} className="text-[12px] text-fg-soft bg-ink/[0.04] border border-ink/[0.06] rounded-lg px-2 py-1">
                {site}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-amber-400/[0.07] border border-amber-400/15 px-3 py-2.5">
            <span className="text-lg">🪙</span>
            <p className="text-[12.5px] text-fg-soft leading-snug">
              Finish to earn <span className="text-amber-400 font-semibold">{SESSION.coins} Focus Coins</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const AuthShowcase = () => (
  <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden items-center justify-center bg-canvas border-l border-ink/[0.04] px-12 py-10">
    {/* Background */}
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-[-25%] left-[-15%] w-[75%] h-[75%] rounded-full opacity-[0.10] blur-[110px]" style={{ background: 'radial-gradient(circle, #6366F1, transparent 70%)' }} />
      <div className="absolute bottom-[-25%] right-[-15%] w-[70%] h-[70%] rounded-full opacity-[0.07] blur-[120px]" style={{ background: 'radial-gradient(circle, #00D2C8, transparent 70%)' }} />
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage: 'radial-gradient(rgb(var(--ink) / 0.06) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 80%)',
        }}
      />
    </div>

    <div className="relative z-10 w-full max-w-[520px]">
      <motion.div {...rise(0.1)}>
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300/90 light:text-indigo-600 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1">
          Built for deep work
        </span>
        <h2 className="mt-4 text-[34px] leading-[1.15] font-semibold tracking-tight text-hi">
          Protect your attention.
          <br />
          <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-teal-200 light:from-indigo-600 light:via-violet-600 light:to-teal-600 bg-clip-text text-transparent">Earn your breaks.</span>
        </h2>
        <p className="mt-3 text-[15px] text-fg-2 leading-relaxed max-w-[440px]">
          Start a session, let the extension guard your focus, and turn every finished session into coins.
        </p>
      </motion.div>

      <motion.div className="mt-7" {...rise(0.25)}>
        <SessionCard />
      </motion.div>

      <motion.div className="mt-6 grid grid-cols-3 gap-3 [@media(max-height:700px)]:hidden" {...rise(0.4)}>
        {FEATURES.map(({ icon: Icon, title, text, color }) => (
          <div key={title} className="rounded-2xl bg-ink/[0.025] border border-ink/[0.06] p-3.5">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5" style={{ background: `${color}1A`, color }}>
              <Icon className="w-4 h-4" />
            </span>
            <p className="text-[13px] font-semibold text-hi mb-0.5">{title}</p>
            <p className="text-[11.5px] text-fg-2 leading-snug">{text}</p>
          </div>
        ))}
      </motion.div>
    </div>
  </div>
);

export default AuthShowcase;
