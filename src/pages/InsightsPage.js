import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import GlassCard from '../components/GlassCard';
import CircularProgress from '../components/CircularProgress';
import PageTransition from '../components/PageTransition';
import api from '../services/api';

/* ── Tooltip ── */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#14171C]/90 backdrop-blur-md border border-white/[0.08] rounded-xl px-4 py-3 shadow-lg">
        <p className="text-gray-400 text-xs mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-white text-sm font-semibold">
            {p.name}: {typeof p.value === 'number' ? Math.round(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const containerV = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemV = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45 } } };

const riskColors = { low: '#3FAE6A', medium: '#F5B638', high: '#EF6B6B' };
const priorityColors = { high: '#EF6B6B', medium: '#F5B638', low: '#3FAE6A' };
const impactColors = { high: '#EF6B6B', medium: '#F5B638', low: '#60A5FA', positive: '#3FAE6A' };

/* ── Skeleton ── */
const LoadingSkeleton = () => (
  <PageTransition>
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="h-7 w-64 bg-white/5 rounded mb-4" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="bg-white/[0.03] rounded-2xl border border-white/[0.04] h-24" />)}
      </div>
      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.04] h-[260px]" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="bg-white/[0.03] rounded-2xl border border-white/[0.04] h-32" />)}
      </div>
    </div>
  </PageTransition>
);

/* ── Empty State ── */
const EmptyInsights = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <span className="text-6xl mb-4">🧠</span>
    <h2 className="text-xl font-bold text-[#F0EEFF] mb-2">No Insights Available Yet</h2>
    <p className="text-[#8B8AA8] text-sm max-w-md leading-relaxed">
      Complete a few focus sessions to generate AI-powered insights. Our Decision Tree model
      analyzes your session patterns, distraction behavior, and browsing activity to give you
      personalized recommendations.
    </p>
  </div>
);

/* ════════════ MAIN PAGE ════════════ */
const InsightsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/insights/full');
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
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-[#8B8AA8] text-lg mb-4">{error}</p>
        <button onClick={fetchInsights} className="px-6 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 font-medium">Retry</button>
      </div>
    </PageTransition>
  );
  if (!data || !data.dataStatus?.hasSessions) return <PageTransition><EmptyInsights /></PageTransition>;

  const { prediction, features, breakdown, productivityWindows, distractionHours, recommendations, sessionRecommendation, trends, topSites, modelPerformance, dataStatus } = data;
  const riskColor = riskColors[prediction?.riskLevel] || '#9CA3AF';

  return (
    <PageTransition>
      <motion.div className="max-w-6xl mx-auto space-y-8" variants={containerV} initial="hidden" animate="visible">

        {/* ═══ A. AI DISTRACTION PREDICTION ═══ */}
        <motion.div variants={itemV}>
          <h2 className="text-[#F0EEFF] font-semibold text-xl mb-4 flex items-center gap-2">🤖 AI Distraction Prediction</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <GlassCard className="text-center">
              <p className="text-[#8B8AA8] text-xs mb-1">Risk Level</p>
              <p className="font-bold text-2xl capitalize" style={{ color: riskColor }}>{prediction?.riskLevel || 'N/A'}</p>
            </GlassCard>
            <GlassCard className="text-center">
              <p className="text-[#8B8AA8] text-xs mb-1">Confidence</p>
              <p className="text-[#F0EEFF] font-bold text-2xl">{prediction?.confidence || 0}%</p>
              <p className="text-[#8B8AA8] text-[10px] mt-0.5">{prediction?.confidenceLabel}</p>
            </GlassCard>
            <GlassCard className="text-center">
              <p className="text-[#8B8AA8] text-xs mb-1">Distraction Score</p>
              <p className="text-[#EF6B6B] font-bold text-2xl">{prediction?.distractionScore || 0}<span className="text-sm text-[#8B8AA8]">/100</span></p>
            </GlassCard>
            <GlassCard className="text-center">
              <p className="text-[#8B8AA8] text-xs mb-1">Focus Score</p>
              <p className="text-[#3FAE6A] font-bold text-2xl">{prediction?.focusScore || 0}<span className="text-sm text-[#8B8AA8]">/100</span></p>
            </GlassCard>
            <GlassCard className="text-center col-span-2 lg:col-span-1">
              <p className="text-[#8B8AA8] text-xs mb-1">Sessions</p>
              <p className="text-[#F0EEFF] font-bold text-2xl">{features?.completedSessions || 0}<span className="text-sm text-[#8B8AA8]">/{features?.totalSessions || 0}</span></p>
              <p className="text-[#8B8AA8] text-[10px] mt-0.5">Completed</p>
            </GlassCard>
          </div>
        </motion.div>

        {/* Explanation Banner */}
        {prediction?.explanation && (
          <motion.div variants={itemV}>
            <GlassCard padding="p-4" className="border-indigo-500/20">
              <div className="flex items-start gap-3">
                <span className="text-lg">💡</span>
                <p className="text-[#C4C1E0] text-sm leading-relaxed">{prediction.explanation}</p>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* ═══ Top Features (Explainable AI) ═══ */}
        {prediction?.topFeatures?.length > 0 && (
          <motion.div variants={itemV}>
            <h2 className="text-[#F0EEFF] font-semibold text-xl mb-4 flex items-center gap-2">🔍 Key Contributing Factors</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {prediction.topFeatures.map((f, i) => (
                <GlassCard key={i} padding="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: impactColors[f.impact] || '#9CA3AF' }} />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[#F0EEFF] text-sm font-semibold">{f.feature}</span>
                        <span className="text-[#8B8AA8] text-xs bg-white/5 px-2 py-0.5 rounded-full">{f.value}</span>
                      </div>
                      <p className="text-[#8B8AA8] text-xs leading-relaxed">{f.explanation}</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══ B. DISTRACTION BREAKDOWN ═══ */}
        <motion.div variants={itemV}>
          <h2 className="text-[#F0EEFF] font-semibold text-xl mb-4 flex items-center gap-2">📊 Distraction Breakdown</h2>
          <GlassCard>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Blocked Visit Ratio', val: breakdown?.visitRatio || 0, color: (breakdown?.visitRatio || 0) > 30 ? '#EF6B6B' : '#3FAE6A' },
                { label: 'Time on Blocked Sites', val: breakdown?.timeRatio || 0, color: (breakdown?.timeRatio || 0) > 30 ? '#EF6B6B' : '#3FAE6A' },
                { label: 'Context Switch Rate', val: breakdown?.switchRate || 0, color: (breakdown?.switchRate || 0) > 40 ? '#EF6B6B' : '#F5B638' },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center">
                  <CircularProgress value={item.val} max={100} size={100} strokeWidth={8} color={item.color} label={`${item.val}%`} />
                  <p className="text-[#8B8AA8] text-sm mt-3">{item.label}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* ═══ C. PRODUCTIVITY WINDOWS ═══ */}
        {productivityWindows?.hasSufficientData && (
          <motion.div variants={itemV}>
            <h2 className="text-[#F0EEFF] font-semibold text-xl mb-4 flex items-center gap-2">📈 Focus Pattern Analysis</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <GlassCard className="text-center">
                <p className="text-[#8B8AA8] text-xs mb-1">Best Focus Hours</p>
                <p className="text-[#F0EEFF] font-bold text-lg">{productivityWindows.bestFocusHours || 'N/A'}</p>
              </GlassCard>
              <GlassCard className="text-center">
                <p className="text-[#8B8AA8] text-xs mb-1">Weakest Hours</p>
                <p className="text-[#F5B638] font-bold text-lg">{productivityWindows.weakestHours || 'N/A'}</p>
              </GlassCard>
              <GlassCard className="text-center">
                <p className="text-[#8B8AA8] text-xs mb-1">Avg Session</p>
                <p className="text-[#F0EEFF] font-bold text-lg">{productivityWindows.avgSessionMinutes || 0} min</p>
              </GlassCard>
              <GlassCard className="text-center">
                <p className="text-[#8B8AA8] text-xs mb-1">Optimal Length</p>
                <p className="text-[#7C5CFC] font-bold text-lg">{productivityWindows.optimalSessionLength || 25} min</p>
              </GlassCard>
            </div>

            {/* Hourly focus score chart */}
            {productivityWindows.hourlyData?.length > 0 && (
              <GlassCard>
                <p className="text-[#8B8AA8] text-xs mb-3 font-medium uppercase tracking-wider">Hourly Focus Score</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={productivityWindows.hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="label" stroke="#6B6A85" fontSize={10} tickLine={false} interval={1} />
                    <YAxis stroke="#6B6A85" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="focusScore" radius={[4, 4, 0, 0]} barSize={20}>
                      {productivityWindows.hourlyData.map((entry, i) => (
                        <Cell key={i} fill={entry.focusScore >= 60 ? '#3FAE6A' : entry.focusScore >= 30 ? '#F5B638' : '#EF6B6B'} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </GlassCard>
            )}
          </motion.div>
        )}

        {/* ═══ D. HIGH DISTRACTION HOURS ═══ */}
        {distractionHours?.hasSufficientData && distractionHours.topRiskHours?.length > 0 && (
          <motion.div variants={itemV}>
            <h2 className="text-[#F0EEFF] font-semibold text-xl mb-4 flex items-center gap-2">📉 High Risk Distraction Hours</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {distractionHours.topRiskHours.map((h, i) => (
                <GlassCard key={i} className="text-center">
                  <CircularProgress
                    value={h.riskPercent} max={100} size={80} strokeWidth={6}
                    color={h.riskPercent > 60 ? '#EF6B6B' : h.riskPercent > 30 ? '#F5B638' : '#3FAE6A'}
                    label={`${h.riskPercent}%`}
                  />
                  <p className="text-[#F0EEFF] text-sm font-medium mt-2">{h.label}</p>
                  <p className="text-[#8B8AA8] text-[10px]">{h.blockedAttempts} blocked attempts</p>
                </GlassCard>
              ))}
            </div>
            {distractionHours.peakDistractionWindow && (
              <GlassCard padding="p-3" className="border-red-500/10">
                <p className="text-[#C4C1E0] text-sm text-center">
                  <span className="text-[#EF6B6B] font-medium">AI Analysis:</span> Your distraction risk peaks during{' '}
                  <span className="text-[#F0EEFF] font-semibold">{distractionHours.peakDistractionWindow}</span>.
                  Consider scheduling lighter tasks or enabling strict mode during this window.
                </p>
              </GlassCard>
            )}
          </motion.div>
        )}

        {/* ═══ E. PERSONALIZED RECOMMENDATIONS ═══ */}
        {recommendations?.length > 0 && (
          <motion.div variants={itemV}>
            <h2 className="text-[#F0EEFF] font-semibold text-xl mb-4 flex items-center gap-2">🧠 Personalized Recommendations</h2>
            {sessionRecommendation && (
              <GlassCard hover className="mb-4">
                <div className="flex gap-4">
                  <span className="text-3xl flex-shrink-0">⏱️</span>
                  <div>
                    <h3 className="text-[#F0EEFF] font-semibold mb-1">Recommended Session Time</h3>
                    <p className="text-[#8B8AA8] text-sm">
                      Based on your patterns, try a <strong className="text-[#F0EEFF]">{sessionRecommendation.recommendedSessionTime}-minute</strong> session
                      followed by a <strong className="text-[#F0EEFF]">{sessionRecommendation.suggestedBreakTime}-minute</strong> break.
                    </p>
                  </div>
                </div>
              </GlassCard>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.slice(0, 6).map((rec, i) => (
                <motion.div key={rec.id || i} initial={{ opacity: 0, x: i % 2 === 0 ? -15 : 15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.07 }}>
                  <GlassCard hover className="h-full">
                    <div className="flex gap-4">
                      <span className="text-2xl flex-shrink-0">{rec.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-[#F0EEFF] font-semibold text-sm">{rec.title}</h3>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${priorityColors[rec.priority]}20`, color: priorityColors[rec.priority] }}>
                            {rec.priority}
                          </span>
                        </div>
                        <p className="text-[#8B8AA8] text-xs leading-relaxed mb-2">{rec.description}</p>
                        {rec.metric && (
                          <div className="flex items-center gap-2">
                            <span className="text-[#7C5CFC] text-xs font-bold">{rec.metric}</span>
                            <span className="text-[#6B6A85] text-[10px]">{rec.metricLabel}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══ F. 7-DAY TREND ANALYTICS ═══ */}
        {trends && (
          <motion.div variants={itemV}>
            <h2 className="text-[#F0EEFF] font-semibold text-xl mb-4 flex items-center gap-2">📈 7-Day Trends</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <GlassCard className="text-center">
                <p className="text-[#8B8AA8] text-xs mb-1">Total Focus</p>
                <p className="text-[#F0EEFF] font-bold text-xl">{Math.round((trends.totalFocusMinutes || 0) / 60 * 10) / 10}h</p>
              </GlassCard>
              <GlassCard className="text-center">
                <p className="text-[#8B8AA8] text-xs mb-1">Consistency</p>
                <p className="font-bold text-xl" style={{ color: trends.consistencyScore >= 70 ? '#3FAE6A' : trends.consistencyScore >= 40 ? '#F5B638' : '#EF6B6B' }}>
                  {trends.consistencyScore || 0}%
                </p>
              </GlassCard>
              <GlassCard className="text-center">
                <p className="text-[#8B8AA8] text-xs mb-1">Distractions</p>
                <p className="text-[#EF6B6B] font-bold text-xl">{trends.totalDistractions || 0}</p>
              </GlassCard>
            </div>

            {/* Focus trend chart */}
            {trends.focusTrend?.length > 0 && (
              <GlassCard className="mb-4">
                <p className="text-[#8B8AA8] text-xs mb-3 font-medium uppercase tracking-wider">Focus Minutes (7 Days)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trends.focusTrend}>
                    <defs>
                      <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C5CFC" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7C5CFC" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="day" stroke="#6B6A85" fontSize={12} tickLine={false} />
                    <YAxis stroke="#6B6A85" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="focusMinutes" name="Focus Min" stroke="#7C5CFC" fill="url(#focusGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </GlassCard>
            )}

            {/* Distraction trend */}
            {trends.distractionTrend?.some(d => d.attempts > 0) && (
              <GlassCard>
                <p className="text-[#8B8AA8] text-xs mb-3 font-medium uppercase tracking-wider">Distraction Trend (7 Days)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={trends.distractionTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="day" stroke="#6B6A85" fontSize={12} tickLine={false} />
                    <YAxis stroke="#6B6A85" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="attempts" name="Blocked Attempts" fill="#EF6B6B" radius={[4, 4, 0, 0]} barSize={30} fillOpacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              </GlassCard>
            )}
          </motion.div>
        )}

        {/* ═══ G. TOP SITES ═══ */}
        {topSites?.length > 0 && (
          <motion.div variants={itemV}>
            <h2 className="text-[#F0EEFF] font-semibold text-xl mb-4 flex items-center gap-2">🌐 Most Visited Sites (7 Days)</h2>
            <GlassCard>
              <div className="space-y-2">
                {topSites.slice(0, 8).map((site, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-[#6B6A85] text-xs font-mono w-5">#{i + 1}</span>
                      <span className="text-[#F0EEFF] text-sm font-medium">{site._id}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[#8B8AA8] text-xs">{site.visits} visits</span>
                      <span className="text-[#8B8AA8] text-xs">{Math.round(site.totalDuration / 60)}m</span>
                      {site.blockedVisits > 0 && <span className="text-red-400 text-xs font-medium">{site.blockedVisits} blocked</span>}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* ═══ H. MODEL PERFORMANCE ═══ */}
        {modelPerformance && (
          <motion.div variants={itemV}>
            <h2 className="text-[#F0EEFF] font-semibold text-xl mb-4 flex items-center gap-2">⚙️ Model Performance</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {[
                { label: 'Accuracy', val: modelPerformance.accuracy, color: '#3FAE6A' },
                { label: 'Precision', val: modelPerformance.precision, color: '#60A5FA' },
                { label: 'Recall', val: modelPerformance.recall, color: '#F5B638' },
                { label: 'F1 Score', val: modelPerformance.f1Score, color: '#7C5CFC' },
              ].map((m, i) => (
                <GlassCard key={i} className="text-center">
                  <p className="text-[#8B8AA8] text-xs mb-1">{m.label}</p>
                  <p className="font-bold text-2xl" style={{ color: m.color }}>{m.val != null ? `${m.val}%` : 'N/A'}</p>
                </GlassCard>
              ))}
            </div>
            <GlassCard padding="p-4" className="border-[rgba(124,92,252,0.15)]">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">🤖</span>
                <div>
                  <h3 className="text-[#F0EEFF] font-semibold mb-1">How our AI works</h3>
                  <p className="text-[#8B8AA8] text-sm leading-relaxed">
                    DistractFree uses a <strong className="text-[#C4C1E0]">{modelPerformance.modelType}</strong> trained on session behavior data.
                    It analyzes your session duration, tab switches, interruptions, and blocked site attempts
                    to predict distraction risk. All predictions are computed in real-time.
                    {modelPerformance.trainingSamples && ` Trained on ${modelPerformance.trainingSamples} samples.`}
                    {!dataStatus?.hasEnoughData && ' Predictions will become more accurate as you complete more sessions.'}
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}

      </motion.div>
    </PageTransition>
  );
};

export default InsightsPage;
