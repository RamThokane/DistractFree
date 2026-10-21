import React from 'react';
import { motion } from 'framer-motion';
import { useTheme, useChartTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, Cell, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import GlassNavbar from '../components/GlassNavbar';
import BrandFilm from '../components/BrandFilm';
import ThemeToggle from '../components/ThemeToggle';
import Wordmark from '../components/Wordmark';
import '../styles/landing.css';

/* ═══════════════════════════════════════════════════════════════
   DistractFree — Landing Page
   Warm paper, one green accent, serif display type.
   Styles live in styles/landing.css, scoped under .lp
   ═══════════════════════════════════════════════════════════════ */

/* ── Mock chart data for product previews ── */
const weeklyData = [
  { d: 'Mon', m: 180 }, { d: 'Tue', m: 210 }, { d: 'Wed', m: 155 },
  { d: 'Thu', m: 240 }, { d: 'Fri', m: 195 }, { d: 'Sat', m: 130 }, { d: 'Sun', m: 170 },
];
const HIGHLIGHT_DAY = 'Thu';

const trendData = [
  { w: 'W1', s: 48 }, { w: 'W2', s: 55 }, { w: 'W3', s: 62 },
  { w: 'W4', s: 68 }, { w: 'W5', s: 74 }, { w: 'W6', s: 78 },
];

/* Chart colours have to be real values (SVG attributes can't read CSS vars) */
const useLandingPalette = () => {
  const { isDark } = useTheme();
  return isDark
    ? { accent: '#7FC2A3', muted: '#3A3732', surface: '#201F1C', loss: '#E58C78' }
    : { accent: '#1F5E4A', muted: '#DCD5C9', surface: '#FFFFFF', loss: '#A63D2A' };
};

/* ── Animation presets (short and quiet) ── */
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.3, ease: 'easeOut', delay },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

/* ── Plain frame for product mockups ── */
const WindowFrame = ({ children, className = '', title = '' }) => (
  <div className={`lp-frame ${className}`}>
    {title && <div className="lp-frame-title">{title}</div>}
    <div className="p-5">{children}</div>
  </div>
);

/* ── Small inline stat for mockup dashboards ── */
const MiniStat = ({ label, value, sub, className = '' }) => (
  <div className={`lp-stat ${className}`}>
    <p className="lp-stat-label">{label}</p>
    <p className="lp-stat-value">{value}</p>
    {sub && <p className="lp-stat-sub">{sub}</p>}
  </div>
);

/* ══════════════════════════════════════════════════════════════ */
/*  LANDING PAGE                                                 */
/* ══════════════════════════════════════════════════════════════ */

const LandingPage = () => {
  const chart = useChartTheme();
  const palette = useLandingPalette();
  const [scrolled, setScrolled] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState('');

  // Track which nav section is in view as the user scrolls.
  React.useEffect(() => {
    const sectionIds = ['how-it-works', 'product', 'research'];
    const observers = [];

    // Keep a map of ratio-per-section so we highlight the most visible one.
    const ratios = {};

    const pickActive = () => {
      let best = '';
      let bestRatio = 0;
      for (const [id, ratio] of Object.entries(ratios)) {
        if (ratio > bestRatio) { bestRatio = ratio; best = id; }
      }
      setActiveSection(best ? `#${best}` : '');
    };

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          ratios[id] = entry.intersectionRatio;
          pickActive();
        },
        { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0], rootMargin: '-80px 0px 0px 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((obs) => obs.disconnect());
  }, []);

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="lp min-h-screen antialiased relative overflow-clip">

      {/* ────────────── NAV ────────────── */}
      <nav className={`lp-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-5 sm:px-6 h-[72px]">
          <Link to="/" className="lp-wordmark shrink-0" aria-label="DistractFree home">
            <img src="/favicon.svg" alt="DistractFree Logo" className="w-8 h-8 rounded-md" />
            <span className="max-[440px]:sr-only">Distract<em>Free</em></span>
          </Link>

          <GlassNavbar
            items={[
              { label: 'How It Works', path: '#how-it-works' },
              { label: 'Product', path: '#product' },
              { label: 'Research', path: '#research' },
            ]}
            activePath={activeSection}
          />

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ThemeToggle className="lp-nav-icon" />
            <span className="lp-nav-divider hidden sm:block" aria-hidden="true" />
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); alert('🚀 Coming soon to the Chrome Web Store!'); }}
              className="lp-nav-outline hidden sm:inline-flex"
              title="Add to Chrome"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M21.17 8H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3.95 6.06L8.54 14.12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10.88 21.94L15.46 13.88" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="sr-only lg:not-sr-only">Add to Chrome</span>
            </a>
            <Link to="/login" className="lp-nav-link">
              Log in
            </Link>
            <Link to="/register" className="lp-btn lp-btn-sm lp-nav-cta">
              Start Free
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </nav>


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 1 — HERO                                       */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="lp-hero relative pt-28 md:pt-32 pb-14 md:pb-16 px-5 sm:px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-14 lg:gap-8 items-start">
          {/* LEFT — Copy */}
          <div className="lg:col-span-6 flex flex-col">
            <p className="lp-tagline lp-in">
              AI-Powered Focus Companion
              <span className="lp-tag">NEW</span>
            </p>

            <h1 className="lp-display lp-h1 mb-7 lp-in" style={{ animationDelay: '0.05s' }}>
              Focus should feel
              <br />
              <span className="lp-underlined">
                <em>empowering,</em>
                <svg className="lp-underline" viewBox="0 0 300 18" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M3 12.5c38-5.2 82-8.6 131-8.9 52-.3 101 2.4 163 6.6" />
                  <path d="M42 15.5c49-3.4 104-4.6 168-2.3" />
                </svg>
              </span>{' '}not
              <br />
              restrictive.
            </h1>

            <p className="lp-lede max-w-md mb-10 lp-in" style={{ animationDelay: '0.1s' }}>
              <Wordmark /> helps you build sustainable focus habits using AI insights
              and a reward-based system — instead of forceful blocking.
            </p>

            <div className="flex flex-wrap items-center gap-x-7 gap-y-4 lp-in" style={{ animationDelay: '0.15s' }}>
              <Link to="/register" className="lp-btn">
                Start Free
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a href="#how-it-works" className="lp-text-link">
                See How It Works
              </a>
            </div>

            <p className="lp-trust lp-in" style={{ animationDelay: '0.2s' }}>
              <span>Free to start</span>
              <span>Chrome extension</span>
              <span>No credit card</span>
            </p>
          </div>

          {/* RIGHT — Product mockup, offset and overlapping the edge */}
          <motion.div
            className="lg:col-span-6 lg:mt-14 lg:-mr-16 relative"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut', delay: 0.1 }}
          >
            <div className="lp-hero-backing" aria-hidden="true" />
            <WindowFrame title="DistractFree — Dashboard" className="lp-hero-frame">
              <div className="grid grid-cols-3 lp-stat-row mb-6">
                <MiniStat label="Today's Focus" value="2h 25m" sub="+18% vs yesterday" />
                <MiniStat label="Focus Coins" value="340" sub="+45 today" />
                <MiniStat label="Streak" value="12 days" sub="Personal best!" />
              </div>
              <div className="lp-chart-block">
                <p className="lp-stat-label mb-3">Weekly Focus Time</p>
                <ResponsiveContainer width="100%" height={124}>
                  <BarChart data={weeklyData}>
                    <Bar dataKey="m" radius={[3, 3, 0, 0]} barSize={22}>
                      {weeklyData.map((row) => (
                        <Cell key={row.d} fill={row.d === HIGHLIGHT_DAY ? palette.accent : palette.muted} />
                      ))}
                    </Bar>
                    <XAxis dataKey="d" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </WindowFrame>
          </motion.div>
        </div>
      </section>

      <hr className="lp-rule" />


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 2 — PROBLEM STATEMENT                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative py-14 md:py-16 px-5 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            className="lp-display lp-h2 mb-10 max-w-2xl"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
          >
            Most website blockers punish.
            <br />
            <em className="lp-h2-soft">We motivate.</em>
          </motion.h2>

          <motion.div
            className="lp-compare"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            {/* Traditional Blockers */}
            <motion.div className="lp-compare-col lp-compare-old" variants={fadeUp}>
              <p className="lp-compare-head">Traditional blockers</p>
              <ul>
                {[
                  'Harsh restrictions that create frustration',
                  'Easy to bypass — a quick incognito tab away',
                  'Short-term control with no lasting habits',
                ].map((item, i) => (
                  <li key={i}>
                    <span className="lp-compare-mark" aria-hidden="true">×</span>
                    <span className="lp-strike">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* DistractFree */}
            <motion.div className="lp-compare-col lp-compare-new" variants={fadeUp}>
              <p className="lp-compare-head"><Wordmark /></p>
              <ul>
                {[
                  'Reward-based system that makes focus feel good',
                  'AI-guided insights that adapt to your patterns',
                  'Long-term habit building, not temporary fixes',
                ].map((item, i) => (
                  <li key={i}>
                    <span className="lp-compare-mark" aria-hidden="true">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 3 — BRAND FILM                                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <BrandFilm />


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 3.5 — SMART WEBSITE BLOCKING                   */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative py-16 md:py-20 px-5 sm:px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-14 lg:gap-10 items-center">
          <div className="lg:col-span-5">
          <motion.div
            className="mb-10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.p className="lp-marker" data-n="02" variants={fadeUp}>
              Website blocking
            </motion.p>
            <motion.h2 className="lp-display lp-h2 max-w-xl mb-5" variants={fadeUp}>
              Smart Website Blocking — On Your Terms
            </motion.h2>
            <motion.p className="lp-body max-w-lg" variants={fadeUp}>
              During focus sessions, selected websites are temporarily paused.
              You stay in control — always.
            </motion.p>
          </motion.div>

            {/* Numbered steps */}
            <motion.ol
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={stagger}
              className="lp-steps"
            >
              {[
                {
                  title: 'You choose what to block',
                  desc: 'Add any website to your block list. Nothing is forced — you decide what counts as a distraction.',
                },
                {
                  title: 'AI detects distraction risk',
                  desc: 'Our model learns your patterns and flags high-risk periods — so blocking is smarter, not stricter.',
                },
                {
                  title: 'Earn Focus Coins for staying focused',
                  desc: 'Every focused minute earns coins. Consistency builds momentum and unlocks rewards.',
                },
                {
                  title: 'Unlock sites intentionally',
                  desc: 'Need a break? Spend Focus Coins to temporarily access blocked sites. It\'s your choice, always.',
                },
              ].map((item, i) => (
                <motion.li key={i} className="lp-step" variants={fadeUp}>
                  <span className="lp-step-num" aria-hidden="true">{i + 1}</span>
                  <div>
                    <h3 className="lp-step-title">{item.title}</h3>
                    <p className="lp-step-desc">{item.desc}</p>
                  </div>
                </motion.li>
              ))}
            </motion.ol>
          </div>

            {/* Right — Mock blocked screen */}
            <motion.div
              className="lg:col-span-6 lg:col-start-7 relative"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <div className="lp-frame lp-frame-tilt overflow-hidden">
                {/* Address bar */}
                <div className="lp-frame-bar">
                  <div className="lp-address">
                    twitter.com
                  </div>
                </div>

                {/* Blocked content */}
                <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                  <div className="lp-shield mb-6">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>

                  <h3 className="lp-display text-[1.75rem] leading-tight text-hi mb-1">
                    This site is paused
                  </h3>
                  <p className="text-fg-2 text-sm mb-8">
                    You're in a focus session.
                  </p>

                  {/* Timer */}
                  <div className="mb-7">
                    <p className="text-xs text-fg-2 mb-1.5">Return in</p>
                    <p className="lp-countdown">
                      18:42
                    </p>
                  </div>

                  <div className="w-10 h-px mb-7 bg-ink/15" />

                  {/* Unlock button + hand-drawn note */}
                  <div className="relative">
                    <button className="lp-coin-btn">
                      <span className="lp-coin-dot" aria-hidden="true" />
                      Unlock using 10 Focus Coins
                    </button>
                    <svg className="lp-annotation" viewBox="0 0 120 90" fill="none" aria-hidden="true">
                      <path d="M112 8c-6 22-22 40-48 52-14 6.5-29 9.5-46 10" />
                      <path d="M30 60.5 16.5 70.4 31 78" />
                    </svg>
                  </div>
                </div>
              </div>
            </motion.div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 4 — PRODUCT PREVIEW                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="product" className="lp-alt relative py-16 md:py-20 px-5 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="text-center mb-10"
          >
            <h2 className="lp-display lp-h2">
              See what you're building toward.
            </h2>
          </motion.div>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* Analytics Dashboard — outlined */}
            <motion.div
              className="lg:col-span-7"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <WindowFrame title="Analytics" className="h-full">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lp-stat-row">
                    <MiniStat label="This Week" value="18.5h" sub="+3.2h vs last week" />
                    <MiniStat label="Focus Score" value="78/100" sub="+6 points" />
                  </div>
                  <div className="lp-chart-block">
                    <p className="lp-stat-label mb-3">Improvement Trend</p>
                    <ResponsiveContainer width="100%" height={120}>
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={palette.accent} stopOpacity={0.14} />
                            <stop offset="100%" stopColor={palette.accent} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="s" stroke={palette.accent} strokeWidth={2} fill="url(#trendFill)" dot={false} />
                        <XAxis dataKey="w" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </WindowFrame>
            </motion.div>

            {/* Focus Timer + Coins — borderless, separated by rules */}
            <div className="lg:col-span-5 lg:pt-6">
              <motion.div
                className="lp-plain-card"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
              >
                <p className="lp-plain-title">Focus Timer</p>
                <div className="flex items-center gap-6">
                  {/* Timer ring */}
                  <div className="relative w-24 h-24 flex-shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
                      <circle cx="50" cy="50" r="42" fill="none" stroke={palette.muted} strokeWidth="5" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke={palette.accent} strokeWidth="5"
                        strokeDasharray="264" strokeDashoffset="71" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[8px] font-medium lp-accent-text">In Progress</span>
                      <span className="text-hi font-semibold text-sm tabular-nums">18:32</span>
                    </div>
                  </div>
                  <div>
                    <p className="lp-display text-[1.6rem] leading-tight text-hi">Deep Work Session</p>
                    <p className="text-fg-2 text-xs mt-1">25 min &middot; Earn up to 20 coins</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="lp-plain-card"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                custom={0.05}
              >
                <p className="lp-plain-title">Coin Activity</p>
                <div className="lp-ledger">
                  {[
                    { desc: 'Focus session (25 min)', amt: '+20', color: palette.accent },
                    { desc: 'Unlocked 5 min break', amt: '-10', color: palette.loss },
                    { desc: '7-day streak bonus', amt: '+50', color: palette.accent },
                  ].map((tx, i) => (
                    <div key={i} className="lp-ledger-row">
                      <span className="text-fg-2 text-[13px]">{tx.desc}</span>
                      <span className="text-[13px] font-semibold tabular-nums" style={{ color: tx.color }}>{tx.amt}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 5 — AI TRANSPARENCY                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative py-16 md:py-20 px-5 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-14 lg:gap-12 items-stretch">
            <motion.div
              className="lg:col-span-5"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
            >
              <motion.p className="lp-marker" data-n="03" variants={fadeUp}>
                AI Transparency
              </motion.p>
              <motion.h2 className="lp-display lp-h2 mb-6" variants={fadeUp}>
                AI that explains itself.
              </motion.h2>
              <motion.p className="lp-body mb-10 max-w-lg" variants={fadeUp}>
                We use simple, explainable models to predict your distraction patterns.
                Every recommendation comes with a clear reason — no black-box decisions.
              </motion.p>
              <motion.dl className="lp-tips" variants={fadeUp}>
                {[
                  {
                    title: 'Pattern detection',
                    desc: 'Your distraction risk increases after 45 minutes. Try 40-minute sessions.',
                  },
                  {
                    title: 'Peak hours',
                    desc: 'Your focus score peaks between 9-11 AM. Schedule deep work here.',
                  },
                  {
                    title: 'Break timing',
                    desc: 'A 5-min break every 40 minutes reduces your afternoon distraction rate by 35%.',
                  },
                ].map((tip, i) => (
                  <div key={i} className="lp-tip">
                    <dt>{tip.title}</dt>
                    <dd>{tip.desc}</dd>
                  </div>
                ))}
              </motion.dl>
            </motion.div>

            {/* Chart visualization */}
            <motion.div
              className="lg:col-span-7"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <div className="lp-frame p-6 md:p-8 h-full flex flex-col justify-center">
                <p className="text-sm font-semibold text-hi mb-1">Distraction Risk by Time</p>
                <p className="text-xs text-fg-2 mb-5">AI-generated from your last 30 days</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={[
                    { h: '8am', r: 12 }, { h: '10am', r: 8 }, { h: '12pm', r: 22 },
                    { h: '2pm', r: 58 }, { h: '4pm', r: 72 }, { h: '6pm', r: 45 },
                    { h: '8pm', r: 55 }, { h: '10pm', r: 38 },
                  ]}>
                    <CartesianGrid strokeDasharray="2 4" stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="h" stroke={chart.axis} fontSize={11} tickLine={false} />
                    <YAxis stroke={chart.axis} fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Line
                      type="monotone"
                      dataKey="r"
                      stroke={palette.accent}
                      strokeWidth={2}
                      dot={{ fill: palette.accent, r: 2.5, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: palette.accent, stroke: palette.surface, strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-4 flex items-center gap-2 text-xs text-fg-2">
                  <div className="w-4 h-0.5 lp-accent-bg" />
                  <span>Higher = more vulnerable to distraction</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <hr className="lp-rule" />


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 6 — BUILT ON RESEARCH                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="research" className="relative pt-16 pb-20 md:pt-20 md:pb-24 px-5 sm:px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-8">
          <motion.article
            className="lg:col-span-12 grid lg:grid-cols-12 lg:gap-x-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.p className="lp-marker lg:col-span-4 lg:row-start-1 lg:self-end" data-n="04" variants={fadeUp}>
              Built on research
            </motion.p>
            <motion.h2 className="lp-display lp-h2 mb-8 lg:col-span-4 lg:row-start-2 lg:self-start" variants={fadeUp}>
              Grounded in behavioral science.
            </motion.h2>
            <motion.div className="lp-article lg:col-start-5 lg:col-span-8 lg:row-start-1 lg:row-span-3" variants={fadeUp}>
              <p className="lp-pull">
                <Wordmark /> draws on established research in habit formation, self-determination theory,
                and digital wellbeing. The reward-based model is inspired by intrinsic motivation frameworks
                — the same principles behind why autonomy and competence drive sustained behavior change.
              </p>
              <p>
                Studies consistently show that punitive approaches to screen time (strict blocking, shame-based
                trackers) produce short-term compliance but fail to build lasting habits. Our approach prioritizes
                self-regulation — giving users agency, transparency, and incremental reinforcement.
              </p>
            </motion.div>
            <motion.p className="lp-refs lg:col-start-5 lg:col-span-8" variants={fadeUp}>
              {['Self-Determination Theory', 'Habit Loop Framework', 'Operant Conditioning', 'Flow State Research'].map((tag) => (
                <span key={tag} className="lp-ref">
                  {tag}
                </span>
              ))}
            </motion.p>
          </motion.article>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════ */}
      {/* FINAL CTA                                              */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="px-3 sm:px-6 pb-6">
        <motion.div
          className="lp-cta max-w-6xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
        >
          <div className="lp-cta-inner">
            <div>
              <motion.div variants={fadeUp} className="mb-7">
                <span className="lp-cta-tag">
                  Free to start · No credit card required
                </span>
              </motion.div>

              <motion.h2 className="lp-display lp-cta-title mb-5" variants={fadeUp}>
                <span>Build better</span>
                <br />
                <em>focus habits.</em>
              </motion.h2>
              <motion.p className="lp-cta-sub" variants={fadeUp}>
                Free to start. No credit card required.
              </motion.p>
            </div>
            <motion.div variants={fadeUp} className="lp-cta-action">
              <Link to="/register" className="lp-btn lp-btn-invert lp-btn-lg">
                Create Free Account
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>


      {/* ────────────── FOOTER ────────────── */}
      <footer className="lp-footer px-5 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 py-8">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="DistractFree Logo" className="w-6 h-6 rounded-md" />
            <span className="text-sm text-fg-2">&copy; 2026 <Wordmark /></span>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-fg-2">
            <Link to="/privacy" className="lp-footer-link">Privacy</Link>
            <Link to="/terms" className="lp-footer-link">Terms</Link>
            <Link to="/contact" className="lp-footer-link">Contact</Link>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
