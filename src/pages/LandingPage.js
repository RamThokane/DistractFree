import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import ThemeToggle from '../components/ThemeToggle';

/* ═══════════════════════════════════════════════════════════════
   DistractFree — Landing Page
   Design language: Apple.com × Linear × Notion × Stripe docs
   Off-white, structured, left-aligned, calm, research-driven
   ═══════════════════════════════════════════════════════════════ */

/* ── Mock chart data for product previews ── */
const weeklyData = [
  { d: 'Mon', m: 180 }, { d: 'Tue', m: 210 }, { d: 'Wed', m: 155 },
  { d: 'Thu', m: 240 }, { d: 'Fri', m: 195 }, { d: 'Sat', m: 130 }, { d: 'Sun', m: 170 },
];

const trendData = [
  { w: 'W1', s: 48 }, { w: 'W2', s: 55 }, { w: 'W3', s: 62 },
  { w: 'W4', s: 68 }, { w: 'W5', s: 74 }, { w: 'W6', s: 78 },
];

/* ── Animation presets ── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1], delay },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

/* ── Mini window chrome for product mockups ── */
const WindowFrame = ({ children, className = '', title = '' }) => (
  <div className={`window-frame ${className}`}>
    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
      <div className="window-dot-red" />
      <div className="window-dot-yellow" />
      <div className="window-dot-green" />
      {title && <span className="text-[11px] text-gray-500 ml-3 font-medium">{title}</span>}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

/* ── Small inline stat for mockup dashboards ── */
const MiniStat = ({ label, value, sub }) => (
  <div className="bg-white/[0.06] rounded-xl p-3">
    <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
    <p className="text-white font-semibold text-lg leading-tight">{value}</p>
    {sub && <p className="text-[10px] text-emerald-400 mt-0.5">{sub}</p>}
  </div>
);

/* ══════════════════════════════════════════════════════════════ */
/*  LANDING PAGE                                                 */
/* ══════════════════════════════════════════════════════════════ */

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-land-bg dark:bg-land-dark-bg text-land-text dark:text-land-dark-text antialiased selection:bg-sage-100 selection:text-sage-dark theme-transition">

      {/* ────────────── NAV ────────────── */}
      <nav className="sticky top-0 z-50 land-glass-strong">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-sage flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="font-semibold text-land-text dark:text-land-dark-text tracking-tight">DistractFree</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm text-land-muted dark:text-land-dark-muted">
            <a href="#how-it-works" className="hover:text-land-text dark:hover:text-land-dark-text transition-colors">How it works</a>
            <a href="#product" className="hover:text-land-text dark:hover:text-land-dark-text transition-colors">Product</a>
            <a href="#research" className="hover:text-land-text dark:hover:text-land-dark-text transition-colors">Research</a>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/login"
              className="text-sm font-medium text-land-muted dark:text-land-dark-muted hover:text-land-text dark:hover:text-land-dark-text transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="text-sm font-medium text-white bg-sage hover:bg-sage-light px-5 py-2 rounded-full transition-all duration-200 hover:shadow-md active:scale-[0.97]"
            >
              Start Free
            </Link>
          </div>
        </div>
      </nav>


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 1 — HERO                                       */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="pt-20 md:pt-28 pb-24 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* LEFT — Copy */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.p
              className="text-sage font-medium text-sm mb-5 tracking-wide uppercase"
              variants={fadeUp}
              custom={0}
            >
              AI-powered focus companion
            </motion.p>

            <motion.h1
              className="text-4xl md:text-[3.25rem] lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight text-land-text dark:text-land-dark-text mb-6"
              variants={fadeUp}
              custom={0.05}
            >
              Focus should feel
              <br />
              empowering, not
              <br />
              restrictive.
            </motion.h1>

            <motion.p
              className="text-land-muted dark:text-land-dark-muted text-lg leading-relaxed max-w-lg mb-10"
              variants={fadeUp}
              custom={0.1}
            >
              DistractFree helps you build sustainable focus habits using AI insights
              and a reward-based system — instead of forceful blocking.
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-3"
              variants={fadeUp}
              custom={0.15}
            >
              <Link
                to="/register"
                className="inline-flex items-center gap-2 bg-sage hover:bg-sage-light text-white font-medium px-7 py-3 rounded-full transition-all duration-200 hover:shadow-lg active:scale-[0.97]"
              >
                Start Free
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 border border-land-border dark:border-land-dark-border text-land-muted dark:text-land-dark-muted hover:text-land-text dark:hover:text-land-dark-text hover:border-gray-300 dark:hover:border-gray-600 font-medium px-7 py-3 rounded-full transition-all duration-200"
              >
                See How It Works
              </a>
            </motion.div>
          </motion.div>

          {/* RIGHT — Product mockup */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
          >
            <WindowFrame title="DistractFree — Dashboard">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <MiniStat label="Today's Focus" value="2h 25m" sub="+18% vs yesterday" />
                <MiniStat label="Focus Coins" value="340" sub="+45 today" />
                <MiniStat label="Streak" value="12 days" sub="Personal best!" />
              </div>
              <div className="bg-white/[0.04] rounded-xl p-3">
                <p className="text-[10px] text-gray-500 mb-2">Weekly Focus Time</p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={weeklyData}>
                    <Bar dataKey="m" fill="#4A7C6F" radius={[4, 4, 0, 0]} barSize={24} />
                    <XAxis dataKey="d" stroke="#555" fontSize={9} tickLine={false} axisLine={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </WindowFrame>
          </motion.div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 2 — PROBLEM STATEMENT                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-white dark:bg-land-dark-card">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            className="text-3xl md:text-4xl font-bold tracking-tight text-land-text dark:text-land-dark-text mb-16 max-w-2xl"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
          >
            Most website blockers punish.
            <br />
            <span className="text-land-muted dark:text-land-dark-muted">We motivate.</span>
          </motion.h2>

          <motion.div
            className="grid md:grid-cols-2 gap-6 max-w-4xl"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            {/* Traditional Blockers */}
            <motion.div
              className="border border-land-border dark:border-land-dark-border rounded-2xl p-8 bg-land-subtle dark:bg-land-dark-subtle"
              variants={fadeUp}
            >
              <p className="text-sm font-medium text-land-muted dark:text-land-dark-muted mb-6 uppercase tracking-wide">Traditional blockers</p>
              <ul className="space-y-4">
                {[
                  'Harsh restrictions that create frustration',
                  'Easy to bypass — a quick incognito tab away',
                  'Short-term control with no lasting habits',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-land-muted dark:text-land-dark-muted">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                    <span className="text-[15px] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* DistractFree */}
            <motion.div
              className="border border-sage-100 dark:border-sage-dark/30 rounded-2xl p-8 bg-sage-50 dark:bg-sage-dark/10"
              variants={fadeUp}
            >
              <p className="text-sm font-medium text-sage-dark dark:text-sage-light mb-6 uppercase tracking-wide">DistractFree</p>
              <ul className="space-y-4">
                {[
                  'Reward-based system that makes focus feel good',
                  'AI-guided insights that adapt to your patterns',
                  'Long-term habit building, not temporary fixes',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-land-text dark:text-land-dark-text">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sage flex-shrink-0" />
                    <span className="text-[15px] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 3 — HOW IT WORKS                               */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 px-6 bg-land-bg dark:bg-land-dark-bg">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
          >
            <p className="text-sage font-medium text-sm mb-3 uppercase tracking-wide">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-land-text dark:text-land-dark-text max-w-lg">
              Three steps to sustainable focus.
            </h2>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={stagger}
          >
            {/* Step 1 */}
            <motion.div variants={fadeUp}>
              <div className="land-card rounded-2xl p-6 mb-5 h-48 flex items-end">
                {/* Mini timer mockup */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-land-muted font-medium">Focus Session</span>
                    <span className="text-xs text-sage font-medium">25:00</span>
                  </div>
                  <div className="w-full h-2 bg-land-subtle rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-sage rounded-full"
                      initial={{ width: 0 }}
                      whileInView={{ width: '65%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-sage" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-sm font-medium text-sage">01</span>
                <h3 className="text-lg font-semibold text-land-text dark:text-land-dark-text">Start a Focus Session</h3>
              </div>
              <p className="text-land-muted dark:text-land-dark-muted text-[15px] leading-relaxed pl-8">
                Choose your duration, hit start, and enter a distraction-aware focus state.
              </p>
            </motion.div>

            {/* Step 2 */}
            <motion.div variants={fadeUp}>
              <div className="land-card rounded-2xl p-6 mb-5 h-48 flex items-end">
                {/* Mini coins mockup */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-land-muted font-medium">Session Complete</span>
                  </div>
                  <div className="flex items-center gap-3 bg-sage-50 rounded-xl p-3">
                    <div className="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center text-lg">&#x1FA99;</div>
                    <div>
                      <p className="text-sage-dark font-semibold text-base">+20 Focus Coins</p>
                      <p className="text-sage text-xs">25 min focused session</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex-1 h-1 bg-sage/20 rounded-full">
                      <div className="h-full w-3/4 bg-sage rounded-full" />
                    </div>
                    <span className="text-[10px] text-land-muted">340 total</span>
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-sm font-medium text-sage">02</span>
                <h3 className="text-lg font-semibold text-land-text dark:text-land-dark-text">Earn Focus Coins</h3>
              </div>
              <p className="text-land-muted dark:text-land-dark-muted text-[15px] leading-relaxed pl-8">
                Every focused minute earns coins. Longer sessions are worth more — consistency is rewarded.
              </p>
            </motion.div>

            {/* Step 3 */}
            <motion.div variants={fadeUp}>
              <div className="land-card rounded-2xl p-6 mb-5 h-48 flex items-end">
                {/* Mini unlock mockup */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-land-muted font-medium">Unlock Break</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { mins: '5 min', cost: 10, active: true },
                      { mins: '15 min', cost: 25, active: false },
                      { mins: '30 min', cost: 50, active: false },
                    ].map((opt1, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                          opt1.active ? 'bg-sage-50 border border-sage/20' : 'bg-gray-50 border border-transparent'
                        }`}
                      >
                        <span className={opt1.active ? 'font-medium text-sage-dark' : 'text-land-muted'}>
                          {opt1.mins} break
                        </span>
                        <span className={`flex items-center gap-1 ${opt1.active ? 'text-sage font-medium' : 'text-gray-400'}`}>
                          &#x1FA99; {opt1.cost}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-sm font-medium text-sage">03</span>
                <h3 className="text-lg font-semibold text-land-text dark:text-land-dark-text">Unlock breaks intentionally</h3>
              </div>
              <p className="text-land-muted dark:text-land-dark-muted text-[15px] leading-relaxed pl-8">
                Spend coins on controlled break time. You choose when — it's always your decision.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 3.5 — SMART WEBSITE BLOCKING                   */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-white dark:bg-land-dark-card">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.p
              className="text-sage font-medium text-sm mb-3 uppercase tracking-wide"
              variants={fadeUp}
            >
              Website blocking
            </motion.p>
            <motion.h2
              className="text-3xl md:text-4xl font-bold tracking-tight text-land-text dark:text-land-dark-text max-w-xl mb-4"
              variants={fadeUp}
            >
              Smart Website Blocking — On Your Terms
            </motion.h2>
            <motion.p
              className="text-land-muted dark:text-land-dark-muted text-[15px] leading-relaxed max-w-lg"
              variants={fadeUp}
            >
              During focus sessions, selected websites are temporarily paused.
              You stay in control — always.
            </motion.p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left — Feature list */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={stagger}
              className="space-y-5"
            >
              {[
                {
                  icon: (
                    <svg className="w-5 h-5 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                    </svg>
                  ),
                  title: 'You choose what to block',
                  desc: 'Add any website to your block list. Nothing is forced — you decide what counts as a distraction.',
                },
                {
                  icon: (
                    <svg className="w-5 h-5 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  ),
                  title: 'AI detects distraction risk',
                  desc: 'Our model learns your patterns and flags high-risk periods — so blocking is smarter, not stricter.',
                },
                {
                  icon: (
                    <svg className="w-5 h-5 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  title: 'Earn Focus Coins for staying focused',
                  desc: 'Every focused minute earns coins. Consistency builds momentum and unlocks rewards.',
                },
                {
                  icon: (
                    <svg className="w-5 h-5 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  ),
                  title: 'Unlock sites intentionally',
                  desc: 'Need a break? Spend Focus Coins to temporarily access blocked sites. It\'s your choice, always.',
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="flex gap-4"
                  variants={fadeUp}
                >
                  <div className="w-10 h-10 rounded-xl bg-sage/10 dark:bg-sage/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-land-text dark:text-land-dark-text font-semibold text-[15px] mb-1">{item.title}</h3>
                    <p className="text-land-muted dark:text-land-dark-muted text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Right — Mock blocked screen */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <div className="land-card rounded-2xl overflow-hidden">
                {/* Fake browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-land-border dark:border-land-dark-border bg-land-subtle dark:bg-land-dark-subtle">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                  <div className="flex-1 mx-4">
                    <div className="bg-white dark:bg-land-dark-bg border border-land-border dark:border-land-dark-border rounded-lg px-3 py-1.5 text-xs text-land-muted dark:text-land-dark-muted">
                      twitter.com
                    </div>
                  </div>
                </div>

                {/* Blocked content */}
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  {/* Shield icon */}
                  <div className="w-14 h-14 rounded-2xl bg-sage/10 dark:bg-sage/15 flex items-center justify-center mb-6">
                    <svg className="w-7 h-7 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>

                  <h3 className="text-xl font-semibold text-land-text dark:text-land-dark-text mb-2">
                    This site is paused
                  </h3>
                  <p className="text-land-muted dark:text-land-dark-muted text-sm mb-8">
                    You're in a focus session.
                  </p>

                  {/* Timer */}
                  <div className="mb-6">
                    <p className="text-xs text-land-muted dark:text-land-dark-muted uppercase tracking-wide mb-2">Return in</p>
                    <p className="text-3xl font-bold text-land-text dark:text-land-dark-text tracking-tight font-mono">
                      18:42
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="w-12 h-px bg-land-border dark:bg-land-dark-border mb-6" />

                  {/* Unlock button */}
                  <button className="inline-flex items-center gap-2 border border-land-border dark:border-land-dark-border text-land-muted dark:text-land-dark-muted hover:text-land-text dark:hover:text-land-dark-text text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
                    <span>&#x1FA99;</span>
                    Unlock using 10 Focus Coins
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 4 — PRODUCT PREVIEW                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="product" className="py-24 px-6 bg-white dark:bg-land-dark-card">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 dark:text-land-dark-text tracking-tight mb-3">
              See what you're building toward.
            </h2>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Analytics Dashboard */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={fadeUp}
            >
              <WindowFrame title="Analytics" className="h-full">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat label="This Week" value="18.5h" sub="+3.2h vs last week" />
                    <MiniStat label="Focus Score" value="78/100" sub="+6 points" />
                  </div>
                  <div className="bg-white/[0.04] rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 mb-2">Improvement Trend</p>
                    <ResponsiveContainer width="100%" height={100}>
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4A7C6F" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#4A7C6F" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="s" stroke="#4A7C6F" strokeWidth={2} fill="url(#trendFill)" dot={false} />
                        <XAxis dataKey="w" stroke="#555" fontSize={9} tickLine={false} axisLine={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </WindowFrame>
            </motion.div>

            {/* Focus Timer + Coins */}
            <div className="space-y-6">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
              >
                <WindowFrame title="Focus Timer">
                  <div className="flex items-center gap-6 py-2">
                    {/* Timer ring */}
                    <div className="relative w-24 h-24 flex-shrink-0">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#4A7C6F" strokeWidth="6"
                          strokeDasharray="264" strokeDashoffset="70" strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">18:32</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-400 text-[11px] mb-0.5">In Progress</p>
                      <p className="text-white font-semibold text-base">Deep Work Session</p>
                      <p className="text-gray-500 text-[11px] mt-1">25 min &middot; Earn up to 20 coins</p>
                    </div>
                  </div>
                </WindowFrame>
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                custom={0.1}
              >
                <WindowFrame title="Coin Activity">
                  <div className="space-y-2.5">
                    {[
                      { desc: 'Focus session (25 min)', amt: '+20', color: 'text-emerald-400' },
                      { desc: 'Unlocked 5 min break', amt: '-10', color: 'text-red-400' },
                      { desc: '7-day streak bonus', amt: '+50', color: 'text-emerald-400' },
                    ].map((tx, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <span className="text-gray-400 text-[12px]">{tx.desc}</span>
                        <span className={`text-[12px] font-medium ${tx.color}`}>{tx.amt}</span>
                      </div>
                    ))}
                  </div>
                </WindowFrame>
              </motion.div>
            </div>
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 5 — AI TRANSPARENCY                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-land-bg dark:bg-land-dark-bg">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
            >
              <motion.p
                className="text-sage font-medium text-sm mb-3 uppercase tracking-wide"
                variants={fadeUp}
              >
                AI Transparency
              </motion.p>
              <motion.h2
                className="text-3xl md:text-4xl font-bold tracking-tight text-land-text dark:text-land-dark-text mb-6"
                variants={fadeUp}
              >
                AI that explains itself.
              </motion.h2>
              <motion.p
                className="text-land-muted dark:text-land-dark-muted text-[15px] leading-relaxed mb-6 max-w-lg"
                variants={fadeUp}
              >
                We use simple, explainable models to predict your distraction patterns.
                Every recommendation comes with a clear reason — no black-box decisions.
              </motion.p>
              <motion.div
                className="space-y-4"
                variants={fadeUp}
              >
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
                  <div key={i} className="land-card rounded-xl p-4 flex gap-4">
                    <div className="w-1 rounded-full bg-sage flex-shrink-0" />
                    <div>
                      <p className="text-land-text dark:text-land-dark-text font-medium text-sm mb-0.5">{tip.title}</p>
                      <p className="text-land-muted dark:text-land-dark-muted text-[13px] leading-relaxed">{tip.desc}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Chart visualization */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <div className="land-card rounded-2xl p-6">
                <p className="text-sm font-medium text-land-text dark:text-land-dark-text mb-1">Distraction Risk by Time</p>
                <p className="text-xs text-land-muted dark:text-land-dark-muted mb-4">AI-generated from your last 30 days</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={[
                    { h: '8am', r: 12 }, { h: '10am', r: 8 }, { h: '12pm', r: 22 },
                    { h: '2pm', r: 58 }, { h: '4pm', r: 72 }, { h: '6pm', r: 45 },
                    { h: '8pm', r: 55 }, { h: '10pm', r: 38 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8EBF0" className="dark:opacity-20" />
                    <XAxis dataKey="h" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                    <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Line
                      type="monotone"
                      dataKey="r"
                      stroke="#4A7C6F"
                      strokeWidth={2}
                      dot={{ fill: '#4A7C6F', r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#4A7C6F', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-3 flex items-center gap-2 text-xs text-land-muted dark:text-land-dark-muted">
                  <div className="w-3 h-0.5 bg-sage rounded" />
                  <span>Higher = more vulnerable to distraction</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 6 — BUILT ON RESEARCH                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="research" className="py-24 px-6 bg-white dark:bg-land-dark-card">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.p
              className="text-sage font-medium text-sm mb-3 uppercase tracking-wide"
              variants={fadeUp}
            >
              Built on research
            </motion.p>
            <motion.h2
              className="text-3xl md:text-4xl font-bold tracking-tight text-land-text dark:text-land-dark-text mb-6"
              variants={fadeUp}
            >
              Grounded in behavioral science.
            </motion.h2>
            <motion.div className="space-y-5" variants={fadeUp}>
              <p className="text-land-muted dark:text-land-dark-muted text-[15px] leading-[1.8]">
                DistractFree draws on established research in habit formation, self-determination theory,
                and digital wellbeing. The reward-based model is inspired by intrinsic motivation frameworks
                — the same principles behind why autonomy and competence drive sustained behavior change.
              </p>
              <p className="text-land-muted dark:text-land-dark-muted text-[15px] leading-[1.8]">
                Studies consistently show that punitive approaches to screen time (strict blocking, shame-based
                trackers) produce short-term compliance but fail to build lasting habits. Our approach prioritizes
                self-regulation — giving users agency, transparency, and incremental reinforcement.
              </p>
            </motion.div>
            <motion.div
              className="mt-8 flex flex-wrap gap-3"
              variants={fadeUp}
            >
              {['Self-Determination Theory', 'Habit Loop Framework', 'Operant Conditioning', 'Flow State Research'].map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-medium text-land-muted dark:text-land-dark-muted border border-land-border dark:border-land-dark-border rounded-full px-4 py-1.5"
                >
                  {tag}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════ */}
      {/* FINAL CTA                                              */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-28 px-6 bg-land-bg dark:bg-land-dark-bg relative overflow-hidden">
        {/* Subtle glass accent */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-sage/[0.04] blur-[80px]" />
          <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-sage/[0.03] blur-[60px]" />
        </div>

        <motion.div
          className="max-w-2xl mx-auto text-center relative z-10"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
        >
          <motion.h2
            className="text-3xl md:text-5xl font-bold tracking-tight text-land-text dark:text-land-dark-text mb-5"
            variants={fadeUp}
          >
            Build better focus habits.
          </motion.h2>
          <motion.p
            className="text-land-muted dark:text-land-dark-muted text-lg mb-10 max-w-md mx-auto"
            variants={fadeUp}
          >
            Free to start. No credit card required.
          </motion.p>
          <motion.div variants={fadeUp}>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-sage hover:bg-sage-light text-white font-medium px-8 py-3.5 rounded-full transition-all duration-200 hover:shadow-lg active:scale-[0.97] text-base"
            >
              Create Free Account
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </motion.div>
        </motion.div>
      </section>


      {/* ────────────── FOOTER ────────────── */}
      <footer className="border-t border-land-border dark:border-land-dark-border py-8 px-6 bg-white dark:bg-land-dark-card">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-sage flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">D</span>
            </div>
            <span className="text-land-muted dark:text-land-dark-muted text-sm">&copy; 2026 DistractFree</span>
          </div>
          <div className="flex gap-6 text-land-muted dark:text-land-dark-muted text-sm">
            <a href="#privacy" className="hover:text-land-text dark:hover:text-land-dark-text transition-colors">Privacy</a>
            <a href="#terms" className="hover:text-land-text dark:hover:text-land-dark-text transition-colors">Terms</a>
            <a href="#contact" className="hover:text-land-text dark:hover:text-land-dark-text transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
