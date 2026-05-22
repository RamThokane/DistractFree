import React, { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import GlassNavbar from '../components/GlassNavbar';
import '../styles/landing.css';

/* ── 6-Layer Background System ── */
const BackgroundSystem = () => (
  <div className="landing-bg-system">
    <div className="landing-bg-mesh">
      <div className="landing-orb-a" />
      <div className="landing-orb-b" />
      <div className="landing-orb-c" />
      <div className="landing-noise" />
    </div>
  </div>
);

/* ── Upgraded Section Divider (3-layer) ── */
const SectionDivider = () => (
  <div className="section-divider-upgrade" style={{ position: 'relative', zIndex: 1 }}>
    <div className="divider-glow" />
    <div className="divider-line" />
  </div>
);

/* ── Floating CTA Particles ── */
const CTAParticles = () => {
  const particles = [
    { size: 4, color: 'rgba(123,111,238,0.6)', top: '15%', left: '8%',   dur: '3s',   delay: '0s',   drift: '8px' },
    { size: 6, color: 'rgba(0,212,200,0.5)',    top: '70%', left: '12%',  dur: '4.5s', delay: '0.8s', drift: '-12px' },
    { size: 4, color: 'rgba(240,192,64,0.5)',   top: '30%', left: '85%',  dur: '3.8s', delay: '1.5s', drift: '5px' },
    { size: 5, color: 'rgba(123,111,238,0.5)',   top: '60%', left: '90%',  dur: '5s',   delay: '2.2s', drift: '-8px' },
    { size: 3, color: 'rgba(0,212,200,0.4)',    top: '80%', left: '25%',  dur: '3.2s', delay: '0.4s', drift: '10px' },
    { size: 7, color: 'rgba(123,111,238,0.4)',   top: '45%', left: '75%',  dur: '4.2s', delay: '1.2s', drift: '-6px' },
    { size: 4, color: 'rgba(240,192,64,0.4)',   top: '25%', left: '60%',  dur: '5.5s', delay: '2.8s', drift: '4px' },
    { size: 5, color: 'rgba(0,212,200,0.45)',   top: '55%', left: '40%',  dur: '3.6s', delay: '1.8s', drift: '-10px' },
  ];

  return (
    <>
      {particles.map((p, i) => (
        <div
          key={i}
          className="cta-particle"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 6px ${p.color}`,
            top: p.top,
            left: p.left,
            '--dur': p.dur,
            '--delay': p.delay,
            '--drift-x': p.drift,
          }}
        />
      ))}
    </>
  );
};

/* ── Subtle floating background productivity visuals ── */
const BackgroundVisuals = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    {/* Abstract dashboard card outline */}
    <div className="absolute top-[15%] right-[8%] w-[180px] h-[110px] rounded-xl border border-white/[0.03] opacity-[0.4] float-element-2">
      <div className="m-3 h-2 w-16 rounded bg-white/[0.04]" />
      <div className="mx-3 mt-2 h-8 w-24 rounded bg-white/[0.03]" />
      <div className="mx-3 mt-2 flex gap-1">
        <div className="h-1 w-8 rounded bg-white/[0.04]" />
        <div className="h-1 w-6 rounded bg-white/[0.03]" />
      </div>
    </div>

    {/* Timer ring outline */}
    <svg className="absolute bottom-[20%] left-[6%] w-24 h-24 opacity-[0.04] float-element-3" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="42" fill="none" stroke="#5C6BC0" strokeWidth="2" strokeDasharray="180 84" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#7E8CF6" strokeWidth="1" strokeDasharray="120 70" />
    </svg>

    {/* Focus ring */}
    <div className="absolute top-[45%] right-[12%] w-16 h-16 rounded-full border border-white/[0.03] focus-ring-pulse" />
    <div className="absolute top-[46%] right-[12.5%] w-12 h-12 rounded-full border border-white/[0.02] focus-ring-pulse" style={{animationDelay:'1s'}} />

    {/* Abstract workflow lines */}
    <svg className="absolute top-[60%] left-[15%] w-40 h-20 opacity-[0.03] float-element" viewBox="0 0 160 80" fill="none">
      <path d="M0 40 Q40 10 80 40 T160 40" stroke="#5C6BC0" strokeWidth="1.5" />
      <path d="M0 50 Q40 20 80 50 T160 50" stroke="#7E8CF6" strokeWidth="1" />
    </svg>

    {/* Mini graph bars */}
    <div className="absolute bottom-[35%] right-[5%] flex items-end gap-1 opacity-[0.04] float-element-2">
      {[16,28,20,36,24,32,18].map((h,i) => <div key={i} className="w-2 rounded-sm bg-white/40" style={{height:`${h}px`}} />)}
    </div>
  </div>
);

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
  <div className={`window-frame window-frame-upgrade ${className}`}>
    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] window-titlebar-upgrade">
      <div className="window-dot-red window-dot-red-glow" />
      <div className="window-dot-yellow window-dot-yellow-glow" />
      <div className="window-dot-green window-dot-green-glow" />
      {title && <span className="text-[11px] text-gray-500 ml-3 font-medium">{title}</span>}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

/* ── Small inline stat for mockup dashboards ── */
const MiniStat = ({ label, value, sub, className = '' }) => (
  <div className={`bg-white/[0.06] rounded-xl p-3 ${className}`}>
    <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
    <p className="text-white font-semibold text-lg leading-tight">{value}</p>
    {sub && <p className="text-[10px] text-emerald-400 mt-0.5">{sub}</p>}
  </div>
);

/* ══════════════════════════════════════════════════════════════ */
/*  LANDING PAGE                                                 */
/* ══════════════════════════════════════════════════════════════ */

const LandingPage = () => {
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
    <div className="min-h-screen landing-bg text-white antialiased relative overflow-hidden" style={{ background: 'var(--bg-void, #03040a)' }}>
      {/* 6-Layer Background System */}
      <BackgroundSystem />
      <BackgroundVisuals />

      {/* All content above bg system */}
      <div className="landing-page-root">

      {/* ────────────── NAV ────────────── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 landing-nav-upgrade ${scrolled ? 'nav-scrolled' : ''}`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src="/favicon.svg" alt="DistractFree Logo" className="w-8 h-8 rounded-xl transition-transform duration-200 group-hover:scale-105 shadow-sm" />
            <span className="font-semibold text-white tracking-tight">DistractFree</span>
          </Link>

          <GlassNavbar
            items={[
              { label: 'How It Works', path: '#how-it-works' },
              { label: 'Product', path: '#product' },
              { label: 'Research', path: '#research' },
            ]}
            activePath={activeSection}
          />

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="text-sm font-medium text-white px-6 py-2.5 rounded-full landing-nav-cta"
              style={{background:'linear-gradient(135deg, #5C6BC0, #7E8CF6)'}}
            >
              Start Free
            </Link>
          </div>
        </div>
      </nav>


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 1 — HERO                                       */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="hero-section relative z-10 pt-24 md:pt-32 pb-24 px-6" style={{ background: 'transparent' }}>
        {/* Dot grid — hero only */}
        <div className="landing-dot-grid" />
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center" style={{ position: 'relative', zIndex: 1 }}>
          {/* LEFT — Copy */}
          <div className="flex flex-col">
            <p
              className="font-medium text-sm mb-5 tracking-wide uppercase animate-fade-up-headline section-label-upgrade"
            >
              <span className="hero-badge-upgrade inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px]" style={{background:'rgba(123,111,238,0.08)', color: '#a89fff'}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:'#a89fff',display:'inline-block',animation:'pulse 1.8s ease infinite'}} />
                AI-Powered Focus Companion
                <span style={{background:'var(--brand-subtle,rgba(123,111,238,0.07))',color:'var(--brand,#7b6fee)',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:4}}>NEW</span>
              </span>
            </p>

            <h1
              className="text-4xl md:text-[3.25rem] lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight text-white mb-6 animate-fade-up-headline section-headline-upgrade"
              style={{ animationDelay: '0.1s', letterSpacing: '-2px' }}
            >
              Focus should feel
              <br />
              <span className="hero-shimmer-word">empowering,</span> not
              <br />
              restrictive.
            </h1>

            <p
              className="text-gray-400 text-lg leading-relaxed max-w-lg mb-10 animate-fade-up-subtext"
              style={{ animationDelay: '0.3s' }}
            >
              DistractFree helps you build sustainable focus habits using AI insights
              and a reward-based system — instead of forceful blocking.
            </p>

            <div
              className="flex flex-wrap gap-3 animate-fade-up-ctas"
              style={{ animationDelay: '0.5s' }}
            >
              <Link
                to="/register"
                className="inline-flex items-center gap-2 text-white font-medium px-8 py-3.5 rounded-full hero-btn-primary hero-pulse-ring"
                style={{background:'linear-gradient(135deg, #5C6BC0, #7E8CF6)', boxShadow: '0 0 0 1px rgba(123,111,238,0.4), 0 4px 24px rgba(108,92,231,0.4), inset 0 1px 0 rgba(255,255,255,0.18)'}}
              >
                Start Free
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 border border-white/[0.1] text-gray-300 hover:border-white/[0.2] hover:bg-white/[0.04] font-medium px-8 py-3.5 rounded-full spring-hover hero-btn-secondary"
              >
                <span className="play-icon-nudge">▶</span>
                See How It Works
              </a>
            </div>

          </div>

          {/* RIGHT — Product mockup */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
          >
            <div className="animate-dashboard-float hero-mockup-wrapper">
              <WindowFrame title="DistractFree — Dashboard" className="hero-mockup-glow">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <MiniStat label="Today's Focus" value="2h 25m" sub="+18% vs yesterday" />
                  <MiniStat label="Focus Coins" value="340" sub="+45 today" />
                  <MiniStat label="Streak" value="12 days" sub="Personal best!" className="hero-stat-streak" />
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
            </div>
          </motion.div>
        </div>
      </section>

      <SectionDivider />


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 2 — PROBLEM STATEMENT                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-[72px] px-6 problem-section">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-16 max-w-2xl section-headline-upgrade"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
          >
            Most website blockers punish.
            <br />
            <span className="text-gray-500" style={{ fontStyle: 'italic', fontWeight: 300 }}>We motivate.</span>
          </motion.h2>

          <motion.div
            className="grid md:grid-cols-2 gap-6 max-w-4xl"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
            style={{ position: 'relative' }}
          >
            {/* VS Badge */}
            <div className="compare-vs-badge hidden md:flex">VS</div>

            {/* Traditional Blockers */}
            <motion.div
              className="border border-white/[0.06] rounded-2xl p-8 bg-white/[0.03] land-card-upgrade compare-left-card"
              variants={fadeUp}
            >
              <p className="text-sm font-medium text-gray-500 mb-6 uppercase tracking-wide">Traditional blockers</p>
              <ul className="space-y-4">
                {[
                  'Harsh restrictions that create frustration',
                  'Easy to bypass — a quick incognito tab away',
                  'Short-term control with no lasting habits',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-500">
                    <span className="mt-1 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{background:'rgba(255,80,80,0.1)'}}>
                      <span style={{color:'rgba(255,80,80,0.8)', fontSize: 11, fontWeight: 700}}>×</span>
                    </span>
                    <span className="text-[15px] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* DistractFree */}
            <motion.div
              className="border border-indigo-500/20 rounded-2xl p-8 bg-indigo-500/[0.06] land-card-upgrade compare-right-card"
              variants={fadeUp}
            >
              <p className="text-sm font-medium mb-6 uppercase tracking-wide section-label-upgrade">DistractFree</p>
              <ul className="space-y-4">
                {[
                  'Reward-based system that makes focus feel good',
                  'AI-guided insights that adapt to your patterns',
                  'Long-term habit building, not temporary fixes',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-200">
                    <span className="mt-1 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{background:'rgba(0,212,140,0.1)'}}>
                      <span style={{color:'var(--teal, #00d4c8)', fontSize: 11, fontWeight: 700}}>✓</span>
                    </span>
                    <span className="text-[15px] leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <SectionDivider />


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 3 — HOW IT WORKS                               */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="relative z-10 py-24 px-6 how-it-works-section">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
          >
            <p className="font-medium text-sm mb-3 uppercase tracking-wide section-label-upgrade" style={{letterSpacing:'2px'}}>How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white max-w-lg section-headline-upgrade">
              Three steps to sustainable focus.
            </h2>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={stagger}
            style={{ position: 'relative' }}
          >
            {/* Step 1 */}
            <motion.div variants={fadeUp} className="how-it-works-step">
              <div className="land-card land-card-upgrade mocklet-upgrade rounded-2xl p-6 mb-5 h-48 flex items-end">
                {/* Mini timer mockup */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-land-muted font-medium">Focus Session</span>
                    <span className="text-xs text-sage font-medium" style={{fontFamily:'monospace'}}>25:00</span>
                  </div>
                  <div className="w-full h-2 bg-white/[0.04] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-sage rounded-full progress-fill-shimmer"
                      initial={{ width: 0 }}
                      whileInView={{ width: '65%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center step-number-badge" style={{border: '1px solid var(--bd-brand, rgba(123,111,238,0.28))'}}>
                      <svg className="w-3.5 h-3.5 text-sage" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center" style={{background:'var(--bg-overlay, #191d38)',border:'1px solid var(--bd-1, rgba(255,255,255,0.042))'}}>
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-sm font-medium" style={{color:'var(--brand, #7b6fee)'}}>
                  <span className="step-number-badge inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold" style={{background:'var(--brand-subtle)',border:'1px solid var(--bd-brand)'}}>1</span>
                </span>
                <h3 className="text-lg font-semibold text-white">Start a Focus Session</h3>
              </div>
              <p className="text-gray-400 text-[15px] leading-relaxed pl-9">
                Choose your duration, hit start, and enter a distraction-aware focus state.
              </p>
            </motion.div>

            {/* Step 2 — Featured */}
            <motion.div variants={fadeUp} className="how-it-works-step">
              <div className="land-card land-card-upgrade mocklet-upgrade rounded-2xl p-6 mb-5 h-48 flex items-end">
                {/* Mini coins mockup */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-land-muted font-medium">Session Complete</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl p-3" style={{background:'rgba(123,111,238,0.06)'}}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{background:'linear-gradient(135deg,#f0c040,#e8a020)'}}>
                      <span style={{fontSize:18}}>$</span>
                    </div>
                    <div>
                      <p className="font-semibold text-base" style={{color:'var(--gold, #f0c040)'}}>+20 Focus Coins</p>
                      <p className="text-xs" style={{color:'var(--teal, #00d4c8)'}}>25 min focused session</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{background:'rgba(240,192,64,0.15)'}}>
                      <div className="h-full w-3/4 rounded-full progress-fill-shimmer" style={{background:'linear-gradient(90deg, #e8a020, #f0c040)'}} />
                    </div>
                    <span className="text-[10px] text-land-muted">340 total</span>
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-sm font-medium" style={{color:'var(--brand, #7b6fee)'}}>
                  <span className="step-number-badge inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold" style={{background:'var(--brand-subtle)',border:'1px solid var(--bd-brand)'}}>2</span>
                </span>
                <h3 className="text-lg font-semibold text-white">Earn Focus Coins</h3>
              </div>
              <p className="text-gray-400 text-[15px] leading-relaxed pl-9">
                Every focused minute earns coins. Longer sessions are worth more — consistency is rewarded.
              </p>
            </motion.div>

            {/* Step 3 */}
            <motion.div variants={fadeUp} className="how-it-works-step">
              <div className="land-card land-card-upgrade mocklet-upgrade rounded-2xl p-6 mb-5 h-48 flex items-end">
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
                          opt1.active ? '' : ''
                        }`}
                        style={{
                          background: opt1.active ? 'var(--brand-subtle, rgba(123,111,238,0.07))' : 'var(--bg-float, #13162c)',
                          border: opt1.active ? '1px solid var(--bd-brand, rgba(123,111,238,0.28))' : '1px solid var(--bd-1, rgba(255,255,255,0.042))',
                          borderLeft: opt1.active ? '3px solid var(--brand, #7b6fee)' : undefined,
                        }}
                      >
                        <span className={opt1.active ? 'font-medium' : ''} style={{color: opt1.active ? 'var(--tx-1, #eeeef5)' : 'var(--tx-2, #8f8faa)'}}>
                          {opt1.mins} break
                        </span>
                        <span className="flex items-center gap-1" style={{color: opt1.active ? 'var(--gold, #f0c040)' : 'var(--tx-3, #55556e)'}}>
                          <span style={{width:8,height:8,borderRadius:'50%',background:'#f0c040',display:'inline-block'}} /> {opt1.cost}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-sm font-medium" style={{color:'var(--brand, #7b6fee)'}}>
                  <span className="step-number-badge inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold" style={{background:'var(--brand-subtle)',border:'1px solid var(--bd-brand)'}}>3</span>
                </span>
                <h3 className="text-lg font-semibold text-white">Unlock breaks intentionally</h3>
              </div>
              <p className="text-gray-400 text-[15px] leading-relaxed pl-9">
                Spend coins on controlled break time. You choose when — it's always your decision.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <SectionDivider />


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 3.5 — SMART WEBSITE BLOCKING                   */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 px-6 smart-blocking-section">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.p
              className="font-medium text-sm mb-3 uppercase tracking-wide section-label-upgrade"
              variants={fadeUp}
              style={{letterSpacing:'2px'}}
            >
              Website blocking
            </motion.p>
            <motion.h2
              className="text-3xl md:text-4xl font-bold tracking-tight text-white max-w-xl mb-4 section-headline-upgrade"
              variants={fadeUp}
            >
              Smart Website Blocking — On Your Terms
            </motion.h2>
            <motion.p
              className="text-gray-400 text-[15px] leading-relaxed max-w-lg"
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
                  className="flex gap-4 spring-hover"
                  variants={fadeUp}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{background:'var(--brand-subtle, rgba(123,111,238,0.07))', border:'1px solid var(--bd-brand, rgba(123,111,238,0.28))'}}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-[15px] mb-1">{item.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
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
              <div className="land-card land-card-upgrade rounded-2xl overflow-hidden">
                {/* Fake browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b window-titlebar-upgrade">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57] window-dot-red-glow" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E] window-dot-yellow-glow" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28C840] window-dot-green-glow" />
                  <div className="flex-1 mx-4">
                    <div className="rounded-lg px-3 py-1.5 text-xs text-gray-400" style={{background:'var(--bg-overlay, #191d38)', border:'1px solid var(--bd-1)'}}>
                      twitter.com
                    </div>
                  </div>
                </div>

                {/* Blocked content */}
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  {/* Shield icon */}
                  <div className="w-14 h-14 rounded-2xl shield-glow-wrap flex items-center justify-center mb-6">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="url(#shieldGrad)" strokeWidth={1.5}>
                      <defs>
                        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="var(--brand, #7b6fee)" />
                          <stop offset="100%" stopColor="var(--teal, #00d4c8)" />
                        </linearGradient>
                      </defs>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>

                  <h3 className="text-xl font-semibold text-white mb-2">
                    This site is paused
                  </h3>
                  <p className="text-gray-400 text-sm mb-8">
                    You're in a focus session.
                  </p>

                  {/* Timer */}
                  <div className="mb-6">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2" style={{letterSpacing:'2px'}}>Return in</p>
                    <p className="text-3xl font-bold text-white tracking-tight font-mono countdown-glow">
                      18:42
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="w-12 h-px mb-6" style={{background:'linear-gradient(90deg, transparent, var(--bd-2, rgba(255,255,255,0.08)), transparent)'}} />

                  {/* Unlock button */}
                  <button className="inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-full spring-hover" style={{background:'var(--brand-subtle)', border:'1px solid var(--bd-brand)', color:'var(--brand, #7b6fee)'}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:'#f0c040',display:'inline-block'}} />
                    Unlock using 10 Focus Coins
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <SectionDivider />


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 4 — PRODUCT PREVIEW                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="product" className="relative z-10 py-24 px-6 product-section product-ambient-glow">
        <div className="max-w-6xl mx-auto" style={{position:'relative', zIndex:1}}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight mb-3 section-headline-upgrade">
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
                            <stop offset="0%" stopColor="#00d4c8" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#00d4c8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="s" stroke="#00d4c8" strokeWidth={2} fill="url(#trendFill)" dot={false} />
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
                        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                        {/* Glow ring */}
                        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(0,212,200,0.2)" strokeWidth="10"
                          strokeDasharray="264" strokeDashoffset="71" strokeLinecap="round" className="ring-timer-glow" />
                        {/* Progress ring */}
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#00d4c8" strokeWidth="6"
                          strokeDasharray="264" strokeDashoffset="71" strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[7px] font-medium" style={{color:'var(--teal, #00d4c8)'}}>In Progress</span>
                        <span className="text-white font-semibold text-sm" style={{fontFamily:'monospace', filter:'drop-shadow(0 0 8px rgba(0,212,200,0.4))'}}>18:32</span>
                      </div>
                    </div>
                    <div>
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
                      { desc: 'Focus session (25 min)', amt: '+20', color: 'var(--teal, #00d4c8)' },
                      { desc: 'Unlocked 5 min break', amt: '-10', color: 'rgba(255,80,80,0.9)' },
                      { desc: '7-day streak bonus', amt: '+50', color: 'var(--teal, #00d4c8)' },
                    ].map((tx, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <span className="text-gray-400 text-[12px]">{tx.desc}</span>
                        <span className="text-[12px] font-medium" style={{color: tx.color}}>{tx.amt}</span>
                      </div>
                    ))}
                  </div>
                </WindowFrame>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 5 — AI TRANSPARENCY                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 px-6 ai-transparency-section">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
            >
              <motion.p
                className="font-medium text-sm mb-3 uppercase tracking-wide section-label-upgrade"
                variants={fadeUp}
                style={{letterSpacing:'2px'}}
              >
                AI Transparency
              </motion.p>
              <motion.h2
                className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-6 section-headline-upgrade"
                variants={fadeUp}
              >
                AI that explains itself.
              </motion.h2>
              <motion.p
                className="text-gray-400 text-[15px] leading-relaxed mb-6 max-w-lg"
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
                    borderColor: 'var(--brand, #7b6fee)',
                  },
                  {
                    title: 'Peak hours',
                    desc: 'Your focus score peaks between 9-11 AM. Schedule deep work here.',
                    borderColor: 'var(--teal, #00d4c8)',
                  },
                  {
                    title: 'Break timing',
                    desc: 'A 5-min break every 40 minutes reduces your afternoon distraction rate by 35%.',
                    borderColor: 'var(--gold, #f0c040)',
                  },
                ].map((tip, i) => (
                  <div key={i} className="land-card land-card-upgrade rounded-xl p-4 flex gap-4 spring-hover">
                    <div className="w-1 rounded-full flex-shrink-0" style={{background: tip.borderColor}} />
                    <div>
                      <p className="text-white font-medium text-sm mb-0.5">{tip.title}</p>
                      <p className="text-gray-400 text-[13px] leading-relaxed">{tip.desc}</p>
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
              <div className="land-card land-card-upgrade rounded-2xl p-6">
                <p className="text-sm font-medium text-white mb-1">Distraction Risk by Time</p>
                <p className="text-xs text-gray-400 mb-4">AI-generated from your last 30 days</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={[
                    { h: '8am', r: 12 }, { h: '10am', r: 8 }, { h: '12pm', r: 22 },
                    { h: '2pm', r: 58 }, { h: '4pm', r: 72 }, { h: '6pm', r: 45 },
                    { h: '8pm', r: 55 }, { h: '10pm', r: 38 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8EBF0" className="opacity-10" />
                    <XAxis dataKey="h" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                    <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Line
                      type="monotone"
                      dataKey="r"
                      stroke="#00d4c8"
                      strokeWidth={2}
                      dot={{ fill: '#00d4c8', r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#00d4c8', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-3 h-0.5 rounded" style={{background:'var(--teal, #00d4c8)'}} />
                  <span>Higher = more vulnerable to distraction</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <SectionDivider />


      {/* ═══════════════════════════════════════════════════════ */}
      {/* SECTION 6 — BUILT ON RESEARCH                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section id="research" className="relative z-10 py-24 px-6 research-section">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.p
              className="font-medium text-sm mb-3 uppercase tracking-wide section-label-upgrade"
              variants={fadeUp}
              style={{letterSpacing:'2px'}}
            >
              Built on research
            </motion.p>
            <motion.h2
              className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-6 section-headline-upgrade"
              variants={fadeUp}
            >
              Grounded in behavioral science.
            </motion.h2>
            <motion.div className="space-y-5" variants={fadeUp}>
              <p className="text-gray-400 text-[15px] leading-[1.8]">
                DistractFree draws on established research in habit formation, self-determination theory,
                and digital wellbeing. The reward-based model is inspired by intrinsic motivation frameworks
                — the same principles behind why autonomy and competence drive sustained behavior change.
              </p>
              <p className="text-gray-400 text-[15px] leading-[1.8]">
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
                  className="text-xs font-medium rounded-full px-4 py-1.5 spring-hover cursor-pointer"
                  style={{
                    color: 'var(--tx-2, #8f8faa)',
                    border: '1px solid var(--bd-1, rgba(255,255,255,0.042))',
                    background: 'rgba(255,255,255,0.025)',
                    transition: 'all 0.2s var(--ease-spring)',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'var(--brand-subtle)';
                    e.target.style.borderColor = 'var(--bd-brand)';
                    e.target.style.color = 'var(--tx-1)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255,255,255,0.025)';
                    e.target.style.borderColor = 'var(--bd-1)';
                    e.target.style.color = 'var(--tx-2)';
                  }}
                >
                  {tag}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      <SectionDivider />


      {/* ═══════════════════════════════════════════════════════ */}
      {/* FINAL CTA                                              */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="py-28 px-6 final-cta-section relative overflow-hidden cta-section-upgrade cta-bg-depth">
        {/* Floating particles */}
        <CTAParticles />

        <motion.div
          className="max-w-2xl mx-auto text-center relative z-10"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
        >
          {/* Badge */}
          <motion.div variants={fadeUp} className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[12px]" style={{background:'var(--brand-subtle)', border:'1px solid var(--bd-brand)', color:'var(--tx-2)'}}>
              Free to start · No credit card required
            </span>
          </motion.div>

          <motion.h2
            className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-5"
            variants={fadeUp}
            style={{letterSpacing: '-2px'}}
          >
            <span className="section-headline-upgrade">Build better</span>
            <br />
            <span className="hero-shimmer-word" style={{fontSize:'inherit', fontWeight:'inherit'}}>focus habits.</span>
          </motion.h2>
          <motion.p
            className="text-gray-400 text-lg mb-10 max-w-md mx-auto"
            variants={fadeUp}
            style={{fontWeight: 300, fontStyle: 'italic'}}
          >
            Free to start. No credit card required.
          </motion.p>
          <motion.div variants={fadeUp}>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 text-white font-medium px-10 py-4 rounded-full text-base hero-btn-primary hero-pulse-ring cta-btn-upgrade"
              style={{
                background:'linear-gradient(135deg, #5C6BC0, #7E8CF6)',
                boxShadow: '0 0 0 1px rgba(123,111,238,0.4), 0 4px 24px rgba(108,92,231,0.4), inset 0 1px 0 rgba(255,255,255,0.18)',
                height: 60,
                fontSize: 16,
              }}
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
      <footer className="py-8 px-6 footer-upgrade">
        {/* Footer top divider */}
        <div className="section-divider-upgrade mb-8">
          <div className="divider-glow" />
          <div className="divider-line" />
        </div>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="DistractFree Logo" className="w-6 h-6 rounded-lg footer-logo-glow" />
            <span className="text-sm" style={{color:'var(--tx-3, #55556e)'}}>&copy; 2026 DistractFree</span>
          </div>
          <div className="flex gap-6 text-sm" style={{color:'var(--tx-3, #55556e)'}}>
            <a href="#privacy" className="hover:text-white transition-colors duration-200">Privacy</a>
            <a href="#terms" className="hover:text-white transition-colors duration-200">Terms</a>
            <a href="#contact" className="hover:text-white transition-colors duration-200">Contact</a>
          </div>
        </div>
      </footer>

      </div>
    </div>
  );
};

export default LandingPage;
