import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import GlassCard from '../components/GlassCard';
import CircularProgress from '../components/CircularProgress';
import PageTransition from '../components/PageTransition';
import api from '../services/api';

/* ── Custom Tooltip ── */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-dash-border rounded-xl px-4 py-3 shadow-lg">
        <p className="text-dash-muted text-xs mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-dash-text text-sm font-semibold">
            {p.name}: {p.value}{p.name === 'risk' || p.name === 'attempts' ? '' : ''}
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

/* ── Empty State ── */
const EmptyInsights = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <span className="text-6xl mb-4">🧠</span>
    <h2 className="text-xl font-bold text-dash-text mb-2">No Insights Available Yet</h2>
    <p className="text-dash-muted text-sm max-w-md leading-relaxed">
      Complete a few focus sessions to generate AI-powered insights. Our Decision Tree model
      analyzes your session patterns, distraction behavior, and browsing activity to give you
      personalized recommendations.
    </p>
  </div>
);

/* ════════════ AI INSIGHTS PAGE ════════════ */
const InsightsPage = () => {
  const [prediction, setPrediction] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [features, setFeatures] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      const [predRes, analyticsRes] = await Promise.all([
        api.get('/insights/predict').catch(() => null),
        api.get('/insights/analytics', { params: { days: 7 } }).catch(() => null),
      ]);

      if (predRes?.data?.success) {
        setPrediction(predRes.data.prediction);
        setRecommendations(predRes.data.recommendations);
        setFeatures(predRes.data.features);
      }

      if (analyticsRes?.data?.success) {
        setAnalytics(analyticsRes.data.analytics);
      }
    } catch (err) {
      console.error('[Insights] Fetch error:', err);
      setError('Failed to load insights.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  if (loading) {
    return (
      <PageTransition>
        <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
          <div className="h-6 w-56 bg-gray-200 rounded mb-4" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 h-24" />
            ))}
          </div>
          <div className="bg-white rounded-2xl p-7 border border-gray-100 h-[300px]" />
        </div>
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-gray-500 text-lg mb-4">{error}</p>
          <button onClick={fetchInsights} className="px-6 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 font-medium">
            Retry
          </button>
        </div>
      </PageTransition>
    );
  }

  // If no prediction data at all, show empty state
  if (!prediction && !analytics) {
    return (
      <PageTransition>
        <EmptyInsights />
      </PageTransition>
    );
  }

  const riskColors = { low: '#3FAE6A', medium: '#F5B638', high: '#EF6B6B' };
  const riskColor = riskColors[prediction?.distractionRisk] || '#9CA3AF';

  return (
    <PageTransition>
      <motion.div
        className="max-w-6xl mx-auto space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ── ML Prediction Summary ── */}
        {prediction && (
          <motion.div variants={itemVariants}>
            <h2 className="text-dash-text font-semibold text-xl mb-4 flex items-center gap-2">
              🤖 AI Distraction Prediction
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <GlassCard className="text-center">
                <p className="text-dash-muted text-xs mb-1">Risk Level</p>
                <p className="font-bold text-xl capitalize" style={{ color: riskColor }}>
                  {prediction.distractionRisk || 'Unknown'}
                </p>
              </GlassCard>
              <GlassCard className="text-center">
                <p className="text-dash-muted text-xs mb-1">Confidence</p>
                <p className="text-dash-text font-bold text-xl">{prediction.confidence || 0}%</p>
              </GlassCard>
              <GlassCard className="text-center">
                <p className="text-dash-muted text-xs mb-1">Distraction Score</p>
                <p className="text-dash-text font-bold text-xl">{prediction.distractionScore || 0}/100</p>
              </GlassCard>
              <GlassCard className="text-center">
                <p className="text-dash-muted text-xs mb-1">Focus Score</p>
                <p className="text-sage font-bold text-xl">{features?.focusScore || 0}/100</p>
              </GlassCard>
            </div>
          </motion.div>
        )}

        {/* ── Prediction Breakdown ── */}
        {prediction?.breakdown && (
          <motion.div variants={itemVariants}>
            <h2 className="text-dash-text font-semibold text-xl mb-4 flex items-center gap-2">
              📊 Distraction Breakdown
            </h2>
            <GlassCard>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col items-center">
                  <CircularProgress
                    value={prediction.breakdown.visitRatio || 0}
                    max={100}
                    size={100}
                    strokeWidth={8}
                    color={prediction.breakdown.visitRatio > 50 ? '#EF6B6B' : '#3FAE6A'}
                    label={`${prediction.breakdown.visitRatio || 0}%`}
                  />
                  <p className="text-dash-muted text-sm mt-3">Blocked Visit Ratio</p>
                </div>
                <div className="flex flex-col items-center">
                  <CircularProgress
                    value={prediction.breakdown.timeRatio || 0}
                    max={100}
                    size={100}
                    strokeWidth={8}
                    color={prediction.breakdown.timeRatio > 50 ? '#EF6B6B' : '#3FAE6A'}
                    label={`${prediction.breakdown.timeRatio || 0}%`}
                  />
                  <p className="text-dash-muted text-sm mt-3">Time on Blocked Sites</p>
                </div>
                <div className="flex flex-col items-center">
                  <CircularProgress
                    value={prediction.breakdown.switchRate || 0}
                    max={100}
                    size={100}
                    strokeWidth={8}
                    color={prediction.breakdown.switchRate > 50 ? '#EF6B6B' : '#F5B638'}
                    label={`${prediction.breakdown.switchRate || 0}%`}
                  />
                  <p className="text-dash-muted text-sm mt-3">Context Switch Rate</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* ── Personalized Recommendations ── */}
        {recommendations && (
          <motion.div variants={itemVariants}>
            <h2 className="text-dash-text font-semibold text-xl mb-4 flex items-center gap-2">
              🧠 Personalized Recommendations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GlassCard hover className="h-full">
                <div className="flex gap-4">
                  <span className="text-3xl flex-shrink-0">⏱️</span>
                  <div>
                    <h3 className="text-dash-text font-semibold mb-1">Recommended Session Time</h3>
                    <p className="text-dash-muted text-sm leading-relaxed">
                      Based on your patterns, try a <strong>{recommendations.recommendedSessionTime}-minute</strong> session
                      followed by a <strong>{recommendations.suggestedBreakTime}-minute</strong> break.
                    </p>
                  </div>
                </div>
              </GlassCard>

              {recommendations.tips?.map((tip, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                >
                  <GlassCard hover className="h-full">
                    <div className="flex gap-4">
                      <span className="text-3xl flex-shrink-0">💡</span>
                      <div>
                        <h3 className="text-dash-text font-semibold mb-1">AI Tip</h3>
                        <p className="text-dash-muted text-sm leading-relaxed">{tip}</p>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Daily Distraction Trend ── */}
        {analytics?.dailyDistractionTrend?.length > 0 && (
          <motion.div variants={itemVariants}>
            <h2 className="text-dash-text font-semibold text-xl mb-4 flex items-center gap-2">
              📈 Distraction Trend (7 Days)
            </h2>
            <GlassCard>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics.dailyDistractionTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EBF0" />
                  <XAxis dataKey="_id" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="attempts" fill="#EF6B6B" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </motion.div>
        )}

        {/* ── Top Sites ── */}
        {analytics?.topSites?.length > 0 && (
          <motion.div variants={itemVariants}>
            <h2 className="text-dash-text font-semibold text-xl mb-4 flex items-center gap-2">
              🌐 Most Visited Sites (7 Days)
            </h2>
            <GlassCard>
              <div className="space-y-2">
                {analytics.topSites.slice(0, 8).map((site, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-dash-hover transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-dash-muted text-xs font-mono w-5">#{i + 1}</span>
                      <span className="text-dash-text text-sm font-medium">{site._id}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-dash-muted text-xs">{site.visits} visits</span>
                      <span className="text-dash-muted text-xs">{Math.round(site.totalDuration / 60)}m</span>
                      {site.blockedVisits > 0 && (
                        <span className="text-red-400 text-xs font-medium">{site.blockedVisits} blocked</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* ── Transparent AI Note ── */}
        <motion.div variants={itemVariants}>
          <GlassCard className="border-sage/20">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">🤖</span>
              <div>
                <h3 className="text-dash-text font-semibold mb-1">How our AI works</h3>
                <p className="text-dash-muted text-sm leading-relaxed">
                  DistractFree uses a Decision Tree classifier trained on session behavior data.
                  It analyzes your session duration, tab switches, interruptions, and blocked site attempts
                  to predict distraction risk. All predictions happen in real-time through our Flask ML microservice.
                  Your data is never shared — insights stay private to your account.
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
