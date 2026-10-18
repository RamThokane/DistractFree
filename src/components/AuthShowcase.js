import React, { useEffect, useState } from 'react';
import { LuCoins } from 'react-icons/lu';
import { SESSION_PRESETS, UNLOCK_COST } from '../utils/coinRules';
import { formatTime } from '../utils/helpers';

/* ═══════════════════════════════════════════════════════════
   AuthShowcase — right-hand panel of the login / sign-up pages.
   A quiet green band with one line, a live session preview and
   three plain facts. Green in both themes, like the landing CTA.
   ═══════════════════════════════════════════════════════════ */

const SESSION = SESSION_PRESETS[0];
const BLOCKED_SITES = ['instagram.com', 'youtube.com', 'x.com'];

const FACTS = [
  ['Blocks distractions', 'The extension pauses blocked sites mid-session.'],
  ['Breaks you earn', `Spend ${UNLOCK_COST} coins to unlock a site on purpose.`],
  ['AI insights', 'Learn when you focus best and when you drift.'],
];

/* Live countdown so the preview feels like a running session */
function useCountdown(start) {
  const [left, setLeft] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s <= 1 ? start : s - 1)), 1000);
    return () => clearInterval(id);
  }, [start]);
  return left;
}

function SessionPreview() {
  const left = useCountdown(SESSION.seconds - 3 * 60 - 1);
  const size = 112;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = 1 - left / SESSION.seconds;

  return (
    <div className="rounded-lg bg-card text-text border border-black/10" aria-hidden="true">
      <div className="flex items-center justify-between px-5 py-3 border-b border-line">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-accent" />
          Focus session in progress
        </span>
        <span className="df-mono text-xs text-muted">{SESSION.label}</span>
      </div>

      <div className="flex items-center gap-6 px-5 py-5">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--paper-3)" strokeWidth={stroke} />
            <circle
              cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="df-mono text-[22px] font-medium tracking-tight">{formatTime(left)}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="df-label mb-2">Paused this session</p>
          <ul className="space-y-1 mb-4">
            {BLOCKED_SITES.map((site) => (
              <li key={site} className="text-sm text-text-2">{site}</li>
            ))}
          </ul>
          <p className="flex items-center gap-2 text-sm text-text-2">
            <LuCoins className="text-amber" />
            Finish to earn <span className="df-mono font-semibold text-amber-ink">{SESSION.coins}</span> coins
          </p>
        </div>
      </div>
    </div>
  );
}

const AuthShowcase = () => (
  <aside className="hidden lg:flex lg:w-[54%] items-center justify-center bg-[#1F5E4A] text-[#F4F0E8] px-14 py-12 lg:m-3 lg:rounded-xl">
    <div className="w-full max-w-[500px]">
      <p className="df-mono text-xs uppercase tracking-[0.08em] text-[#C9DBD2]">Built for deep work</p>
      <h2 className="df-display text-t-40 xl:text-t-64 text-[#F4F0E8] mt-4">
        Protect your attention.
        <br />
        <em>Earn your breaks.</em>
      </h2>
      <p className="mt-4 text-[#C9DBD2] leading-relaxed max-w-[440px]">
        Start a session, let the extension guard your focus, and turn every finished session into coins.
      </p>

      <div className="mt-8">
        <SessionPreview />
      </div>

      <dl className="mt-8 grid grid-cols-3 border-t border-white/20 [@media(max-height:760px)]:hidden">
        {FACTS.map(([title, text], i) => (
          <div key={title} className={`pt-4 ${i > 0 ? 'pl-4 border-l border-white/20' : 'pr-4'} ${i === 1 ? 'pr-4' : ''}`}>
            <dt className="text-sm font-semibold text-[#F4F0E8]">{title}</dt>
            <dd className="text-xs text-[#C9DBD2] leading-snug mt-1">{text}</dd>
          </div>
        ))}
      </dl>
    </div>
  </aside>
);

export default AuthShowcase;
