import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useChartTheme } from '../context/ThemeContext';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { LuSparkles } from 'react-icons/lu';
import PageTransition from '../components/PageTransition';
import { Button, Card, Badge, ProgressBar, Skeleton, SkeletonText, EmptyState, ErrorState } from '../components/ui';
import api from '../services/api';
import SessionRecommendation from '../components/SessionRecommendation';

/* ── Tooltip ── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="df-card px-3 py-2 shadow-pop">
      <p className="df-label mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm text-text">
          {p.name}: <span className="df-mono">{typeof p.value === 'number' ? Math.round(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

const RISK_TONE = { low: 'text-accent', medium: 'text-amber-ink', high: 'text-danger' };
const riskMeaning = {
  low: 'Low: likely to finish as planned',
  medium: 'Medium: could go either way',
  high: 'High: unlikely to finish as planned',
};
const PRIORITY_TONE = { high: 'danger', medium: 'amber', low: 'accent' };

/* ── Next-session prediction ── */
const PredictionPanel = ({ prediction, features, dataStatus }) => {
  const isPersonal = prediction?.source === 'model';
  const hasOdds = !(prediction?.successProbability === null || prediction?.successProbability === undefined);
  const success = prediction?.classProbabilities ? Math.round(prediction.classProbabilities.successful * 100) : prediction?.successPercent;

  return (
    <section aria-labelledby="pred-title">
      <div className="pg-head">
        <div>
          <p className="pg-kicker">AI prediction · next session</p>
          <h2 id="pred-title" className="pg-title">
            {hasOdds ? (
              <><span className={RISK_TONE[prediction.riskLevel]}><span className="capitalize">{prediction.riskLevel}</span> risk</span>, <em>{prediction.successPercent}%</em> chance</>
            ) : 'No prediction yet'}
          </h2>
          <p className="pg-sub">
            {isPersonal
              ? `Chance that a ${prediction.plannedDuration}-minute session started now goes to plan (you finish at least 90% of it, with at most one blocked-site attempt).`
              : prediction?.message}
          </p>
        </div>
      </div>

      {prediction?.isColdStart && (
        <div className="rounded-lg bg-accent-soft px-5 py-3 mb-6 text-sm text-text">
          <span className="font-semibold">Not personalised yet</span> — you have no finished sessions. Complete a few sessions to personalise this prediction.
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-8 lg:gap-10">
        {/* The report */}
        <Card className="lg:col-span-8" padding="p-6 md:p-8">
          {!hasOdds ? (
            <p className="text-sm text-muted py-6">{prediction?.explanation || 'No prediction available yet.'}</p>
          ) : (
            <>
              <p className="df-label">{isPersonal ? 'Predicted success' : 'Past success rate'}</p>
              <p className="df-mono text-t-64 leading-none mt-3 text-text">
                {prediction.successPercent}<span className="text-t-28 text-muted">%</span>
              </p>
              <p className="text-sm text-muted mt-2">{riskMeaning[prediction.riskLevel]}</p>
              <ProgressBar
                className="mt-6"
                label={`Successful ${success}% · Not successful ${100 - success}%`}
                value={success}
                tone={prediction.riskLevel === 'high' ? 'danger' : prediction.riskLevel === 'medium' ? 'amber' : 'accent'}
              />
            </>
          )}
        </Card>

        {/* Side numbers */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="py-5 border-t border-line-strong">
            <p className="df-label">Focus score · last 7 days</p>
            <p className="df-mono text-t-64 leading-none mt-2 text-accent">
              {prediction?.focusScore || 0}<span className="text-t-28 text-muted">/100</span>
            </p>
          </div>
          <div className="py-5 border-t border-line">
            <p className="df-label">Sessions · last 7 days</p>
            <p className="df-mono text-t-40 mt-2 text-text">
              {features?.completedSessions || 0}<span className="text-t-28 text-muted">/{features?.totalSessions || 0}</span>
            </p>
            <p className="text-sm text-muted mt-1">Completed · {dataStatus?.allTimeFinishedSessions ?? 0} finished all-time</p>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ── Skeleton ── */
const LoadingSkeleton = () => (
  <PageTransition>
    <div aria-busy="true" aria-label="Loading insights">
      <Skeleton width={180} height={12} />
      <Skeleton className="mt-3" width="min(520px, 90%)" height={48} />
      <div className="grid lg:grid-cols-12 gap-10 mt-10">
        <div className="lg:col-span-8"><Skeleton height={380} radius={10} /></div>
        <div className="lg:col-span-4"><SkeletonText lines={6} /></div>
      </div>
    </div>
  </PageTransition>
);

const Section = ({ id, title, note, children }) => (
  <section className="pg-section" aria-labelledby={id}>
    <div className="pg-section-head">
      <h2 id={id} className="pg-h2">{title}</h2>
      {note && <span className="text-xs text-muted text-right">{note}</span>}
    </div>
    {children}
  </section>
);

/* ════════════ MAIN PAGE ════════════ */
const InsightsPage = () => {
  const chart = useChartTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await api.get(`/insights/full?tz=${encodeURIComponent(tz)}`);
      if (res.data?.success) setData(res.data);
      else setError('Failed to load insights');
    } catch (err) {
      console.error('[Insights] Fetch error:', err);
      setError('Failed to load insights.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  if (loading) return <LoadingSkeleton />;
  if (error) return (
    <PageTransition>
      <ErrorState title="Insights didn’t load" action={<Button variant="secondary" onClick={fetchInsights}>Try again</Button>}>
        {error} Your sessions are safe; this page only reads them.
      </ErrorState>
    </PageTransition>
  );
  if (!data) return (
    <PageTransition>
      <EmptyState icon={LuSparkles} title="No insights yet" action={<Button as={Link} to="/dashboard/focus">Start a session</Button>}>
        Complete a few focus sessions to generate insights. DistractFree uses your own session history to estimate,
        before you start, how likely your next session is to succeed.
      </EmptyState>
    </PageTransition>
  );

  const { prediction, features, breakdown, productivityWindows, distractionHours, recommendations, sessionRecommendation, trends, topSites, dataStatus } = data;
  const scoreColor = (v) => (v >= 60 ? chart.accent : v >= 30 ? chart.amber : chart.danger);

  return (
    <PageTransition>
      {/* Best next session — the actionable answer first */}
      <div className="mb-12">
        <SessionRecommendation compact />
      </div>

      {/* A. AI prediction — shown even with no recent sessions */}
      <PredictionPanel prediction={prediction} features={features} dataStatus={dataStatus} />

      {/* B. Distraction breakdown */}
      <Section id="breakdown-title" title="Distraction breakdown">
        <div className="grid md:grid-cols-2 gap-8">
          {[
            { label: 'Blocked visit ratio', hint: 'Share of your visits that hit a blocked site', val: breakdown?.visitRatio || 0, warnAt: 30 },
            { label: 'Context switch rate', hint: 'How often you jump between work and blocked sites', val: breakdown?.switchRate || 0, warnAt: 40 },
          ].map((item) => (
            <div key={item.label}>
              <p className="df-mono text-t-40 text-text">{item.val}%</p>
              <ProgressBar className="mt-3" label={item.label} value={item.val} tone={item.val > item.warnAt ? 'danger' : 'accent'} />
              <p className="text-xs text-muted mt-2">{item.hint}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* C. Productivity windows */}
      {productivityWindows?.hasSufficientData && (
        <Section id="pattern-title" title="Focus patterns" note="Sessions grouped by start hour · last 30 days">
          <dl className="pg-stats pg-stats--4 mb-8">
            {[
              ['Best focus hours', productivityWindows.bestFocusHours || 'N/A', 'text-accent'],
              ['Weakest hours', productivityWindows.weakestHours || 'N/A', 'text-amber-ink'],
              ['Avg session', `${productivityWindows.avgSessionMinutes || 0} min`, 'text-text'],
              ['Optimal length', `${productivityWindows.optimalSessionLength || 25} min`, 'text-text'],
            ].map(([label, value, tone]) => (
              <div key={label}>
                <dt className="df-label">{label}</dt>
                <dd className={`df-mono text-lg mt-1 ${tone}`}>{value}</dd>
              </div>
            ))}
          </dl>

          {productivityWindows.hourlyData?.length > 0 && (
            <>
              <p className="pg-h3 mb-3">Hourly focus score</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={productivityWindows.hourlyData} margin={{ left: -18, right: 4 }}>
                  <CartesianGrid vertical={false} stroke={chart.grid} />
                  <XAxis dataKey="label" stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} interval={0} />
                  <YAxis stroke={chart.axis} fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: chart.cursor }} />
                  <Bar dataKey="focusScore" name="Focus score" radius={[3, 3, 0, 0]} barSize={20}>
                    {productivityWindows.hourlyData.map((entry, i) => (
                      <Cell key={i} fill={scoreColor(entry.focusScore)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </Section>
      )}

      {/* D. High distraction hours */}
      {distractionHours?.hasSufficientData && distractionHours.topRiskHours?.length > 0 && (
        <Section id="risk-hours-title" title="High-risk hours" note="Risk % = 100 − that hour's focus score (hours with only blocked attempts: 10% per attempt)">
          <ol>
            {distractionHours.topRiskHours.map((h, i) => (
              <li key={i} className="grid grid-cols-[2rem_minmax(0,9rem)_1fr_3.5rem] items-center gap-4 py-3 border-b border-line">
                <span className="df-mono text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-sm font-medium text-text">{h.window || h.label}</span>
                <span>
                  <ProgressBar value={h.riskPercent} tone={h.riskPercent > 60 ? 'danger' : h.riskPercent > 30 ? 'amber' : 'accent'} />
                  <span className="block text-xs text-muted mt-1">{h.blockedAttempts} blocked attempts{h.sessions > 0 ? ` · ${h.sessions} session${h.sessions > 1 ? 's' : ''}` : ''}</span>
                </span>
                <span className="df-mono text-sm text-right text-text">{h.riskPercent}%</span>
              </li>
            ))}
          </ol>
          {distractionHours.peakDistractionWindow && (
            <p className="mt-5 text-sm text-text-2 border-l-2 border-amber pl-4">
              Your distraction risk peaks during <span className="font-semibold text-text">{distractionHours.peakDistractionWindow}</span>.
              Consider scheduling lighter tasks or enabling strict mode during this window.
            </p>
          )}
        </Section>
      )}

      {/* E. Recommendations */}
      {recommendations?.length > 0 && (
        <Section id="recs-title" title="Recommendations">
          {sessionRecommendation && (
            <div className="rounded-lg bg-paper-2 px-6 py-5 mb-6">
              <p className="df-label">Recommended rhythm</p>
              <p className="df-display text-t-28 mt-2 text-text">
                <span className="df-mono">{sessionRecommendation.recommendedSessionTime}</span> min focus, <span className="df-mono">{sessionRecommendation.suggestedBreakTime}</span> min break.
              </p>
              <p className="text-sm text-muted mt-1">Based on how your past sessions went.</p>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-x-10">
            {recommendations.slice(0, 6).map((rec, i) => (
              <article key={rec.id || i} className="py-5 border-b border-line">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h3 className="text-sm font-semibold text-text">{rec.title}</h3>
                  <Badge tone={PRIORITY_TONE[rec.priority] || 'neutral'}>{rec.priority}</Badge>
                </div>
                <p className="text-sm text-text-2 leading-relaxed">{rec.description}</p>
                {rec.metric && (
                  <p className="mt-2 text-xs text-muted"><span className="df-mono text-text">{rec.metric}</span> · {rec.metricLabel}</p>
                )}
              </article>
            ))}
          </div>
        </Section>
      )}

      {/* F. 7-day trends */}
      {trends && (
        <Section id="trends-title" title="Last 7 days">
          <dl className="pg-stats pg-stats--3 mb-8">
            <div>
              <dt className="df-label">Total focus</dt>
              <dd className="df-mono text-t-28 mt-1 text-text">{Math.round((trends.totalFocusMinutes || 0) / 60 * 10) / 10}h</dd>
            </div>
            <div>
              <dt className="df-label">Consistency</dt>
              <dd className={`df-mono text-t-28 mt-1 ${trends.consistencyScore >= 70 ? 'text-accent' : trends.consistencyScore >= 40 ? 'text-amber-ink' : 'text-danger'}`}>{trends.consistencyScore || 0}%</dd>
            </div>
            <div>
              <dt className="df-label">Distractions</dt>
              <dd className="df-mono text-t-28 mt-1 text-text">{trends.totalDistractions || 0}</dd>
            </div>
          </dl>

          <div className="grid lg:grid-cols-2 gap-8">
            {trends.focusTrend?.length > 0 && (
              <div>
                <p className="pg-h3 mb-3">Focus minutes</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trends.focusTrend} margin={{ left: -18, right: 4 }}>
                    <defs>
                      <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chart.accent} stopOpacity={0.16} />
                        <stop offset="100%" stopColor={chart.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={chart.grid} />
                    <XAxis dataKey="day" stroke={chart.axis} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={chart.axis} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: chart.grid }} />
                    <Area type="monotone" dataKey="focusMinutes" name="Focus min" stroke={chart.accent} fill="url(#focusGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {trends.distractionTrend?.some((d) => d.attempts > 0) && (
              <div>
                <p className="pg-h3 mb-3">Blocked attempts</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trends.distractionTrend} margin={{ left: -18, right: 4 }}>
                    <CartesianGrid vertical={false} stroke={chart.grid} />
                    <XAxis dataKey="day" stroke={chart.axis} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={chart.axis} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: chart.cursor }} />
                    <Bar dataKey="attempts" name="Blocked attempts" fill={chart.text} fillOpacity={0.75} radius={[3, 3, 0, 0]} barSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* G. Top sites */}
      {topSites?.length > 0 && (
        <Section id="sites-title" title="Most visited sites" note="Last 7 days">
          <div className="hidden sm:grid grid-cols-[2rem_1fr_5rem_4rem_6rem] gap-4 pb-2 df-label">
            <span>#</span><span>Site</span><span className="text-right">Visits</span><span className="text-right">Time</span><span className="text-right">Blocked</span>
          </div>
          <ol className="pg-rows">
            {topSites.slice(0, 8).map((site, i) => (
              <li key={i} className="grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2rem_1fr_5rem_4rem_6rem] gap-4 items-center py-3 border-b border-line">
                <span className="df-mono text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-sm font-medium text-text truncate">{site._id}</span>
                <span className="df-mono text-sm text-right text-text-2">{site.visits}<span className="sm:hidden text-muted"> visits</span></span>
                <span className="hidden sm:block df-mono text-sm text-right text-text-2">{Math.round(site.totalDuration / 60)}m</span>
                <span className="hidden sm:block df-mono text-sm text-right">{site.blockedVisits > 0 ? <span className="text-text">{site.blockedVisits}</span> : <span className="text-muted">—</span>}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </PageTransition>
  );
};

export default InsightsPage;
