import React, { memo, useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useChartTheme } from '../context/ThemeContext';
import {
  BarChart, Bar, Cell, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { LuTarget, LuArrowUpRight, LuArrowDownRight, LuTimer } from 'react-icons/lu';
import AnimatedCounter from '../components/AnimatedCounter';
import PageTransition from '../components/PageTransition';
import NextScheduledCard from '../components/NextScheduledCard';
import SessionRecommendation from '../components/SessionRecommendation';
import AgentChat from '../components/AgentChat';
import WeeklyReportCard from '../components/WeeklyReportCard';
import { Button, Card, Input, Modal, ProgressBar, Skeleton, SkeletonText, ErrorState, EmptyState, Badge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatMinutesToHours, getGreeting } from '../utils/helpers';

/* ── Chart tooltip in the shared style ── */
const ChartTooltip = memo(({ active, payload, label, unit = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="df-card px-3 py-2 shadow-pop">
      <p className="df-label mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="df-mono text-sm text-text">
          {p.value}{unit}
        </p>
      ))}
    </div>
  );
});
ChartTooltip.displayName = 'ChartTooltip';

/* ── Big "h m" number that counts up ── */
const Duration = ({ minutes }) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return (
    <span className="df-mono">
      {h > 0 && (<><AnimatedCounter value={h} /><span className="text-muted text-[0.5em] ml-1 mr-3">h</span></>)}
      <AnimatedCounter value={m} /><span className="text-muted text-[0.5em] ml-1">m</span>
    </span>
  );
};

/* ── AI risk card: level, odds, and the model's own explanation ── */
const RISK_TONE = { low: 'text-accent', medium: 'text-amber-ink', high: 'text-danger' };
const RISK_BAR = { low: 'accent', medium: 'amber', high: 'danger' };

const RiskCard = memo(({ prediction, details }) => {
  const level = prediction?.riskLevel;
  const isModel = prediction?.source === 'model';
  const isHistory = prediction?.source === 'history';
  const reasons = (details?.reasons || []).slice(0, 3);
  return (
    <Card variant="band" padding="p-6 md:p-7" className="h-full flex flex-col">
      <p className="df-label">Forecast · if you start now</p>
      {level ? (
        <>
          <p className={`df-display text-t-40 mt-3 ${RISK_TONE[level] || 'text-text'}`}><span className="capitalize">{level}</span> risk</p>
          {(isModel || isHistory) && (
            <ProgressBar
              className="mt-4"
              label="Chance it goes to plan"
              valueLabel={`${prediction.successPercent}%`}
              value={prediction.successPercent}
              tone={RISK_BAR[level]}
            />
          )}
          {details?.explanation && <p className="mt-4 text-sm text-text-2 leading-relaxed">{details.explanation}</p>}
          {reasons.length > 0 && (
            <ul className="mt-4 space-y-2.5">
              {reasons.map((r) => (
                <li key={r.feature} className="flex gap-2.5 text-sm text-text-2 leading-snug">
                  {r.effect === 'raises'
                    ? <LuArrowUpRight className="mt-0.5 flex-shrink-0 text-accent" aria-label="raises the chance" />
                    : <LuArrowDownRight className="mt-0.5 flex-shrink-0 text-muted" aria-label="lowers the chance" />}
                  <span>{r.text.replace(/\s*→.*$/, '')}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted mt-4">
            {isModel
              ? prediction.isColdStart ? 'Not personalised yet — it learns from your sessions.' : 'From your AI model, personalised to your sessions.'
              : isHistory ? 'Based on how your past sessions went — same scoring as “Best next session”.' : 'Based on your past sessions so far.'}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">Prediction unavailable right now. Finish a few sessions and it will appear here.</p>
      )}
      <Link to="/dashboard/insights" className="df-link df-link--arrow text-sm mt-auto pt-5 self-start">Full breakdown</Link>
    </Card>
  );
});
RiskCard.displayName = 'RiskCard';

/* ── 7-day strip: one cell per day, filled when you focused ── */
const WeekStrip = ({ days, todayIndex }) => (
  <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="list" aria-label="Focus minutes this week">
    {days.map((d, i) => {
      const on = d.minutes > 0;
      return (
        <div key={d.date || d.day} role="listitem" className="flex flex-col items-center gap-1.5">
          <div
            className={`w-full aspect-square max-h-14 rounded-md flex items-center justify-center df-mono text-xs border ${
              on ? 'bg-accent text-on-accent border-transparent' : 'bg-paper-2 text-muted border-line'
            } ${i === todayIndex ? 'ring-2 ring-offset-2 ring-offset-paper ring-text/60' : ''}`}
            title={`${d.day}: ${d.minutes} min`}
          >
            {on ? d.minutes : '·'}
          </div>
          <span className={`text-[11px] ${i === todayIndex ? 'text-text font-semibold' : 'text-muted'}`}>{d.day}</span>
        </div>
      );
    })}
  </div>
);

/* ── Goal Setting Modal ── */
const GoalModal = ({ onSave, onClose }) => {
  const [goalMinutes, setGoalMinutes] = useState(120);
  const [goalSessions, setGoalSessions] = useState(4);
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      title="Set today’s focus goal"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Skip for now</Button>
          <Button
            loading={saving}
            onClick={async () => { setSaving(true); await onSave({ focusMinutes: goalMinutes, sessions: goalSessions }); setSaving(false); }}
          >
            Set goal
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted mb-5">What do you want to get done today?</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Input label="Focus time (minutes)" type="number" min="15" max="480" value={goalMinutes} onChange={(e) => setGoalMinutes(Number(e.target.value))} />
        <Input label="Sessions" type="number" min="1" max="20" value={goalSessions} onChange={(e) => setGoalSessions(Number(e.target.value))} />
      </div>
    </Modal>
  );
};

/* ── Loading Skeleton (same shape as the page) ── */
const DashboardSkeleton = () => (
  <div aria-busy="true" aria-label="Loading dashboard">
    <Skeleton width={120} height={12} />
    <Skeleton className="mt-3" width="min(420px, 80%)" height={44} />
    <div className="grid lg:grid-cols-12 gap-6 mt-10">
      <div className="lg:col-span-7"><Skeleton width={90} height={12} /><Skeleton className="mt-4" width={260} height={64} /><Skeleton className="mt-6" height={6} /><SkeletonText className="mt-8" lines={2} /></div>
      <div className="lg:col-span-5"><Skeleton height={300} radius={10} /></div>
    </div>
    <Skeleton className="mt-10" height={260} radius={10} />
  </div>
);

const fmtDay = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/* ════════════ DASHBOARD HOME ════════════ */
const DashboardHome = () => {
  const chart = useChartTheme();
  const { user, updateUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [recent, setRecent] = useState({ sessions: null, coins: null });

  // Fetch dashboard data from backend
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await api.get(`/session/dashboard?tz=${encodeURIComponent(tz)}`);
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('[Dashboard] Fetch error:', err);
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Recent activity (read-only, same endpoints the Focus and Coins pages use)
  useEffect(() => {
    let alive = true;
    Promise.allSettled([api.get('/session/history'), api.get('/coins/history')]).then(([s, c]) => {
      if (!alive) return;
      setRecent({
        sessions: s.status === 'fulfilled' ? (s.value.data.sessions || []).slice(0, 5) : [],
        coins: c.status === 'fulfilled' ? (c.value.data.transactions || []).slice(0, 5) : [],
      });
    });
    return () => { alive = false; };
  }, []);

  // Save goal
  const handleSaveGoal = async (goal) => {
    try {
      const res = await api.put('/auth/profile', { dailyGoal: goal });
      if (res.data.success) {
        updateUser(res.data.user);
        setShowGoalModal(false);
        // Refetch dashboard to get updated goal
        fetchDashboard();
      }
    } catch (err) {
      console.error('[Dashboard] Goal save error:', err);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <DashboardSkeleton />
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition>
        <ErrorState
          title="Your dashboard didn’t load"
          action={<Button variant="secondary" onClick={fetchDashboard}>Try again</Button>}
        >
          {error} Check your connection, then try again.
        </ErrorState>
      </PageTransition>
    );
  }

  // Use live data or fallback to 0
  const todayFocusMinutes = data?.todayFocusMinutes || 0;
  const coinsEarnedToday = data?.coinsEarnedToday || 0;
  const currentStreak = data?.currentStreak || user?.currentStreak || 0;
  const goalMinutes = data?.dailyGoal?.focusMinutes || data?.goalMinutes || 120;
  const weeklyFocusData = data?.weeklyFocusData || [];
  const distractionTrend = data?.distractionTrend || [];
  const coinsEarnedWeekly = data?.coinsEarnedWeekly || [];
  const progressPercent = goalMinutes > 0 ? Math.min(100, (todayFocusMinutes / goalMinutes) * 100) : 0;
  // The server sends the last 7 days in your timezone, oldest first — today is the last one
  const todayIndex = weeklyFocusData.length - 1;
  const firstName = (user?.name || 'there').split(' ')[0];

  return (
    <PageTransition>
      <AnimatePresence>
        {showGoalModal && (
          <GoalModal onSave={handleSaveGoal} onClose={() => setShowGoalModal(false)} />
        )}
      </AnimatePresence>

      {/* ── Greeting ── */}
      <div className="pg-head">
        <div>
          <p className="pg-kicker">Today</p>
          <h2 className="pg-title">{getGreeting()}, <em>{firstName}</em>.</h2>
          <p className="pg-sub">Here's your productivity overview today.</p>
        </div>
        <Button variant="secondary" icon={<LuTarget size={16} aria-hidden="true" />} onClick={() => setShowGoalModal(true)}>
          Set today's goal
        </Button>
      </div>

      {/* ── Today + AI forecast ── */}
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
        <section className="lg:col-span-7 flex flex-col" aria-labelledby="today-focus">
          <p id="today-focus" className="df-label">Focused today</p>
          <p className="text-t-64 md:text-t-88 leading-none mt-3 text-text">
            <Duration minutes={todayFocusMinutes} />
          </p>
          <ProgressBar
            className="mt-6 max-w-xl"
            label={`Daily goal · ${formatMinutesToHours(goalMinutes)}`}
            valueLabel={`${Math.round(progressPercent)}%`}
            value={todayFocusMinutes}
            max={goalMinutes}
          />

          <div className="pg-stats pg-stats--3 mt-8">
            <div>
              <p className="df-label">Coins today</p>
              <p className="df-mono text-t-28 text-amber-ink mt-1">+<AnimatedCounter value={coinsEarnedToday} /></p>
            </div>
            <div>
              <p className="df-label">Sessions</p>
              <p className="df-mono text-t-28 text-text mt-1"><AnimatedCounter value={data?.sessionsToday || 0} /></p>
            </div>
            <div>
              <p className="df-label">Streak</p>
              <p className="df-mono text-t-28 text-text mt-1"><AnimatedCounter value={currentStreak} /><span className="text-sm text-muted ml-1.5">days</span></p>
            </div>
          </div>

          {weeklyFocusData.length === 7 && (
            <div className="mt-8">
              <p className="df-label mb-3">Last 7 days</p>
              <WeekStrip days={weeklyFocusData} todayIndex={todayIndex} />
            </div>
          )}
        </section>

        <div className="lg:col-span-5">
          <RiskCard prediction={data?.mlPrediction} details={data?.nextSessionPrediction} />
        </div>
      </div>

      {/* ── Best next session (time × length) ── */}
      <div className="mt-10">
        <SessionRecommendation />
      </div>

      {/* ── Next scheduled session ── */}
      <div className="mt-8">
        <NextScheduledCard />
      </div>

      {/* ── Last week's AI report ── */}
      <div className="mt-10">
        <WeeklyReportCard />
      </div>

      {/* ── Focus coach (AI assistant) ── */}
      <div className="mt-10">
        <AgentChat />
      </div>

      {/* ── Weekly focus + recent sessions ── */}
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 mt-10">
        <Card className="lg:col-span-7" padding="p-6 md:p-7">
          <div className="flex items-baseline justify-between gap-4 mb-5">
            <div>
              <h3 className="pg-h2">Weekly focus</h3>
              <p className="pg-note">Minutes per day, last 7 days · today on the right</p>
            </div>
          </div>
          {weeklyFocusData.some((d) => d.minutes > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weeklyFocusData} margin={{ left: -18, right: 4 }}>
                <CartesianGrid vertical={false} stroke={chart.grid} />
                <XAxis dataKey="day" stroke={chart.axis} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={chart.axis} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip unit=" min" />} cursor={{ fill: chart.cursor }} />
                <Bar dataKey="minutes" radius={[3, 3, 0, 0]} barSize={28}>
                  {weeklyFocusData.map((d, i) => (
                    <Cell key={d.date || d.day} fill={i === todayIndex ? chart.accent : chart.accentMuted} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={LuTimer} title="No focus time this week yet" action={<Button as={Link} to="/dashboard/focus" size="sm">Start a session</Button>}>
              Finish one session and this chart starts filling in.
            </EmptyState>
          )}
        </Card>

        <section className="lg:col-span-5" aria-labelledby="recent-sessions">
          <div className="pg-section-head">
            <h3 id="recent-sessions" className="pg-h2">Recent sessions</h3>
            <Link to="/dashboard/insights" className="df-link text-sm">History</Link>
          </div>
          {recent.sessions === null ? (
            <SkeletonText lines={5} />
          ) : recent.sessions.length === 0 ? (
            <p className="pg-note">No sessions yet. Your first one will show up here.</p>
          ) : (
            <div>
              {recent.sessions.map((s) => (
                <div key={s._id} className="pg-row">
                  <div className="pg-row-main">
                    <p className="pg-row-title">{s.duration} of {s.plannedDuration} min</p>
                    <p className="pg-row-meta">{fmtDay(s.startTime)} · {fmtTime(s.startTime)}</p>
                  </div>
                  {s.status === 'completed'
                    ? <Badge tone="accent">Completed</Badge>
                    : s.status === 'active' ? <Badge tone="accent" dot>Running</Badge> : <Badge>Ended early</Badge>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Coins + distraction ── */}
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 mt-10">
        <section className="lg:col-span-5" aria-labelledby="coin-activity">
          <div className="pg-section-head">
            <h3 id="coin-activity" className="pg-h2">Coin activity</h3>
            <Link to="/dashboard/coins" className="df-link text-sm">Wallet</Link>
          </div>
          {recent.coins === null ? (
            <SkeletonText lines={5} />
          ) : recent.coins.length === 0 ? (
            <p className="pg-note">No coins yet. A finished 25-minute session earns your first ones.</p>
          ) : (
            <div>
              {recent.coins.map((t) => (
                <div key={t._id} className="pg-row">
                  <div className="pg-row-main">
                    <p className="pg-row-title truncate">{t.description || (t.amount > 0 ? 'Earned' : 'Spent')}</p>
                    <p className="pg-row-meta">{fmtDay(t.createdAt)} · {fmtTime(t.createdAt)}</p>
                  </div>
                  <span className={`pg-amount ${t.amount > 0 ? 'pg-amount--coin' : 'pg-amount--minus'}`}>
                    {t.amount > 0 ? '+' : '−'}{Math.abs(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="lg:col-span-7 grid sm:grid-cols-2 gap-8">
          <div>
            <h3 className="pg-h3">Coins earned</h3>
            <p className="pg-note mb-4">Per day this week</p>
            {coinsEarnedWeekly.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={coinsEarnedWeekly} margin={{ left: -24, right: 4 }}>
                  <defs>
                    <linearGradient id="coinFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chart.amber} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={chart.amber} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={chart.grid} />
                  <XAxis dataKey="day" stroke={chart.axis} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={chart.axis} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip unit=" coins" />} cursor={{ stroke: chart.grid }} />
                  <Area type="monotone" dataKey="coins" stroke={chart.amber} strokeWidth={2} fill="url(#coinFill)" dot={false} activeDot={{ r: 4, fill: chart.amber, stroke: chart.surface, strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="pg-note">No coin data yet.</p>
            )}
          </div>
          <div>
            <h3 className="pg-h3">Distraction trend</h3>
            <p className="pg-note mb-4">Blocked-site attempts during sessions. Lower is better.</p>
            {distractionTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={distractionTrend} margin={{ left: -24, right: 4 }}>
                  <CartesianGrid vertical={false} stroke={chart.grid} />
                  <XAxis dataKey="day" stroke={chart.axis} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={chart.axis} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip unit=" attempts" />} cursor={{ stroke: chart.grid }} />
                  <Line type="monotone" dataKey="score" name="Blocked attempts" stroke={chart.text} strokeWidth={1.75} dot={{ fill: chart.text, r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4, fill: chart.text, stroke: chart.surface, strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="pg-note">No distraction data yet.</p>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default DashboardHome;
