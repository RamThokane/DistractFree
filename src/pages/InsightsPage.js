import React from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import GlassCard from '../components/GlassCard';
import CircularProgress from '../components/CircularProgress';
import PageTransition from '../components/PageTransition';
import { mockInsights } from '../utils/mockData';

/* ── Custom Tooltip ── */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-dash-border rounded-xl px-4 py-3 shadow-lg">
        <p className="text-dash-muted text-xs mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-dash-text text-sm font-semibold">
            {p.name}: {p.value}{p.name === 'risk' ? '%' : ''}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

/* ════════════ AI INSIGHTS PAGE ════════════ */
const InsightsPage = () => {
  const { focusPattern, highRiskHours, recommendations, improvementTrend } = mockInsights;

  return (
    <PageTransition>
      <motion.div
        className="max-w-6xl mx-auto space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ── Section: Focus Pattern Analysis ── */}
        <motion.div variants={itemVariants}>
          <h2 className="text-dash-text font-semibold text-xl mb-4 flex items-center gap-2">
            📊 Focus Pattern Analysis
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <GlassCard className="text-center">
              <p className="text-dash-muted text-xs mb-1">Best Focus Hours</p>
              <p className="text-dash-text font-bold text-lg">{focusPattern.bestHour}</p>
            </GlassCard>
            <GlassCard className="text-center">
              <p className="text-dash-muted text-xs mb-1">Weakest Hours</p>
              <p className="text-orange-400 font-bold text-lg">{focusPattern.worstHour}</p>
            </GlassCard>
            <GlassCard className="text-center">
              <p className="text-dash-muted text-xs mb-1">Avg Session</p>
              <p className="text-dash-text font-bold text-lg">{focusPattern.avgSessionLength} min</p>
            </GlassCard>
            <GlassCard className="text-center">
              <p className="text-dash-muted text-xs mb-1">Optimal Length</p>
              <p className="text-sage font-bold text-lg">{focusPattern.optimalSessionLength} min</p>
            </GlassCard>
          </div>
        </motion.div>

        {/* ── Section: High Risk Distraction Hours ── */}
        <motion.div variants={itemVariants}>
          <h2 className="text-dash-text font-semibold text-xl mb-4 flex items-center gap-2">
            📉 High Risk Distraction Hours
          </h2>
          <GlassCard>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {highRiskHours.map((h, i) => (
                <div key={i} className="flex flex-col items-center">
                  <CircularProgress
                    value={h.risk}
                    max={100}
                    size={90}
                    strokeWidth={8}
                    color={h.risk > 70 ? '#EF6B6B' : h.risk > 50 ? '#F5B638' : '#3FAE6A'}
                    label={`${h.risk}%`}
                  />
                  <p className="text-dash-muted text-sm mt-2">{h.hour}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-sage-50 border border-sage-100 rounded-xl p-4">
              <p className="text-dash-muted text-sm">
                <span className="text-sage font-medium">AI Analysis: </span>
                Your distraction risk peaks between 2-4 PM. Consider scheduling lighter tasks or
                a pre-planned unlock during this window to stay in control.
              </p>
            </div>
          </GlassCard>
        </motion.div>

        {/* ── Section: Personalized Recommendations ── */}
        <motion.div variants={itemVariants}>
          <h2 className="text-dash-text font-semibold text-xl mb-4 flex items-center gap-2">
            🧠 Personalized Recommendations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <GlassCard hover className="h-full">
                  <div className="flex gap-4">
                    <span className="text-3xl flex-shrink-0">{rec.icon}</span>
                    <div>
                      <h3 className="text-dash-text font-semibold mb-1">{rec.title}</h3>
                      <p className="text-dash-muted text-sm leading-relaxed">{rec.text}</p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Section: Improvement Trend ── */}
        <motion.div variants={itemVariants}>
          <h2 className="text-dash-text font-semibold text-xl mb-4 flex items-center gap-2">
            📈 Improvement Trend
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlassCard>
              <h3 className="text-dash-text font-semibold mb-1">Focus Score Over Time</h3>
              <p className="text-dash-muted text-sm mb-4">Your weekly AI Focus Score progression</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={improvementTrend}>
                  <defs>
                    <linearGradient id="improvGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3FAE6A" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3FAE6A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EBF0" />
                  <XAxis dataKey="week" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#3FAE6A"
                    strokeWidth={2}
                    fill="url(#improvGradient)"
                    dot={{ fill: '#3FAE6A', r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, stroke: '#3FAE6A', strokeWidth: 2, fill: '#FFFFFF' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </GlassCard>

            <GlassCard>
              <h3 className="text-dash-text font-semibold mb-1">Distraction Risk by Hour</h3>
              <p className="text-dash-muted text-sm mb-4">Peak vulnerability windows</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={highRiskHours}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EBF0" />
                  <XAxis dataKey="hour" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="risk" radius={[6, 6, 0, 0]} barSize={40}>
                    {highRiskHours.map((entry, idx) => (
                      <motion.rect
                        key={idx}
                        fill={entry.risk > 70 ? '#EF6B6B' : entry.risk > 50 ? '#F5B638' : '#3FAE6A'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>
        </motion.div>

        {/* ── Transparent AI Note ── */}
        <motion.div variants={itemVariants}>
          <GlassCard className="border-sage/20">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">🤖</span>
              <div>
                <h3 className="text-dash-text font-semibold mb-1">How our AI works</h3>
                <p className="text-dash-muted text-sm leading-relaxed">
                  DistractFree AI analyzes your session patterns, break timing, and focus consistency
                  to generate personalized insights. All recommendations are based on behavioral psychology
                  research. Your data is never shared — insights stay private to your account.
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </PageTransition>
  );
};

export default InsightsPage;
