import React, { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import CircularProgress from '../components/CircularProgress';
import AnimatedCounter from '../components/AnimatedCounter';
import PageTransition from '../components/PageTransition';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatMinutesToHours, getGreeting } from '../utils/helpers';
import {
  HiOutlineClock,
  HiOutlineFire,
  HiOutlineSparkles,
} from 'react-icons/hi2';

/* ── Custom Recharts Tooltip ── */
const CustomTooltip = memo(({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#14171C]/90 backdrop-blur-md border border-white/[0.08] rounded-2xl px-5 py-4 shadow-glass">
        <p className="text-gray-400 text-xs mb-1.5 uppercase tracking-wide">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-white text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
            {p.name}: {p.value}{p.name === 'minutes' ? ' min' : ''}
          </p>
        ))}
      </div>
    );
  }
  return null;
});
CustomTooltip.displayName = 'CustomTooltip';

/* ── Metric Card Component ── */
const MetricCard = memo(({ icon: Icon, iconBg, iconColor, label, sublabel, value, suffix, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="bg-white rounded-2xl p-6 border border-gray-100 shadow-card-soft hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 group"
  >
    <div className="flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-sm text-gray-500 mb-0.5">{label}</p>
        {sublabel && <p className="text-[10px] text-gray-400 -mt-1 mb-1">{sublabel}</p>}
        <div className="flex items-baseline gap-1">
          <AnimatedCounter value={value} className="text-2xl font-bold text-gray-900" />
          {suffix && <span className="text-gray-400 text-sm font-medium">{suffix}</span>}
        </div>
      </div>
    </div>
  </motion.div>
));
MetricCard.displayName = 'MetricCard';

/* ── Chart Card Wrapper ── */
const ChartCard = memo(({ title, subtitle, children, className = '', delay = 0 }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
  >
    <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-card-soft hover:shadow-card-hover transition-all duration-300 h-full">
      {title && <h3 className="text-gray-900 font-bold text-lg mb-1">{title}</h3>}
      {subtitle && <p className="text-gray-500 text-sm mb-6">{subtitle}</p>}
      {children}
    </div>
  </motion.div>
));
ChartCard.displayName = 'ChartCard';

/* ── Goal Setting Modal ── */
const GoalModal = ({ onSave, onClose }) => {
  const [goalMinutes, setGoalMinutes] = useState(120);
  const [goalSessions, setGoalSessions] = useState(4);

  return (
    <motion.div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-md mx-4 border border-gray-100"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        <h2 className="text-xl font-bold text-gray-900 mb-2">🎯 Set Today's Focus Goal</h2>
        <p className="text-gray-500 text-sm mb-6">What do you want to achieve today?</p>

        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Focus Time Target (minutes)
            </label>
            <input
              type="number"
              min="15"
              max="480"
              value={goalMinutes}
              onChange={(e) => setGoalMinutes(Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Target Sessions
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={goalSessions}
              onChange={(e) => setGoalSessions(Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
          >
            Skip for now
          </button>
          <button
            onClick={() => onSave({ focusMinutes: goalMinutes, sessions: goalSessions })}
            className="flex-1 px-4 py-3 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 transition-colors font-semibold shadow-lg shadow-indigo-200"
          >
            Set Goal
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ── Loading Skeleton ── */
const DashboardSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    <div>
      <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
      <div className="h-7 w-48 bg-gray-200 rounded mb-1" />
      <div className="h-4 w-64 bg-gray-200 rounded" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="h-11 w-11 bg-gray-200 rounded-xl mb-3" />
          <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
          <div className="h-6 w-16 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl p-7 border border-gray-100 h-[340px]" />
      <div className="bg-white rounded-2xl p-7 border border-gray-100 h-[340px]" />
    </div>
  </div>
);

/* ════════════ DASHBOARD HOME ════════════ */
const DashboardHome = () => {
  const { user, updateUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showGoalModal, setShowGoalModal] = useState(false);

  // Fetch dashboard data from backend
  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/session/dashboard');
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
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-gray-500 text-lg mb-4">{error}</p>
          <button onClick={fetchDashboard} className="px-6 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors font-medium">
            Retry
          </button>
        </div>
      </PageTransition>
    );
  }

  // Use live data or fallback to 0
  const todayFocusMinutes = data?.todayFocusMinutes || 0;
  const coinsEarnedToday = data?.coinsEarnedToday || 0;
  const currentStreak = data?.currentStreak || user?.currentStreak || 0;
  const aiFocusScore = data?.aiFocusScore || 0;
  const goalMinutes = data?.dailyGoal?.focusMinutes || data?.goalMinutes || 120;
  const weeklyFocusData = data?.weeklyFocusData || [];
  const distractionTrend = data?.distractionTrend || [];
  const coinsEarnedWeekly = data?.coinsEarnedWeekly || [];
  const progressPercent = goalMinutes > 0 ? Math.min(100, (todayFocusMinutes / goalMinutes) * 100) : 0;

  return (
    <PageTransition>
      <div className="space-y-8">
        {/* Goal Modal */}
        <AnimatePresence>
          {showGoalModal && (
            <GoalModal
              onSave={handleSaveGoal}
              onClose={() => setShowGoalModal(false)}
            />
          )}
        </AnimatePresence>

        {/* ── Greeting Section ── */}
        <motion.div
          className="flex flex-col md:flex-row md:items-end justify-between gap-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <p className="text-sm text-gray-400 mb-1">{getGreeting()}</p>
            <h1 className="text-2xl md:text-[1.75rem] font-semibold text-gray-900 tracking-tight">
              {user?.name || 'User'}
            </h1>
            <p className="text-sm text-gray-400 mt-1">Here's your productivity overview today.</p>
          </div>
          <button
            onClick={() => setShowGoalModal(true)}
            className="px-5 py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 border border-indigo-100"
          >
            🎯 Set Today's Goal
          </button>
        </motion.div>

        {/* ── Metric Cards Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            icon={HiOutlineClock}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            label="Today's Focus Time"
            value={todayFocusMinutes}
            suffix="min"
            delay={0}
          />
          <MetricCard
            icon={() => <span className="text-xl">🪙</span>}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
            label="Coins Earned Today"
            value={coinsEarnedToday}
            delay={0.08}
          />
          <MetricCard
            icon={HiOutlineFire}
            iconBg="bg-orange-50"
            iconColor="text-orange-500"
            label="Current Streak"
            value={currentStreak}
            suffix="days"
            delay={0.16}
          />
          <MetricCard
            icon={HiOutlineSparkles}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-500"
            label="AI Focus Score"
            sublabel="(Based on last session)"
            value={aiFocusScore}
            suffix="/100"
            delay={0.24}
          />
        </div>

        {/* ── Analytics Row: Progress Ring + Weekly Focus ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Circular Progress */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-card-soft hover:shadow-card-hover transition-all duration-300 flex flex-col items-center justify-center h-full min-h-[340px]">
              <CircularProgress
                value={todayFocusMinutes}
                max={goalMinutes}
                size={220}
                strokeWidth={16}
                color="#6366F1"
                label={formatMinutesToHours(todayFocusMinutes)}
                sublabel={`of ${formatMinutesToHours(goalMinutes)} goal`}
              />
              <p className="text-gray-500 text-sm mt-6 font-medium">Daily Focus Progress</p>
              <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-full px-6 py-2">
                <span className="text-primary font-semibold text-sm">
                  {Math.round(progressPercent)}% Complete
                </span>
              </div>
            </div>
          </motion.div>

          {/* Weekly Focus Bar Chart */}
          <ChartCard
            title="Weekly Focus Time"
            subtitle="Minutes per day this week"
            delay={0.3}
          >
            {weeklyFocusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={weeklyFocusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="day" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="minutes" fill="#6366F1" radius={[8, 8, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-gray-400 text-sm">
                Complete your first focus session to see weekly data.
              </div>
            )}
          </ChartCard>
        </div>

        {/* ── Secondary Analytics: Distraction Trend + Coins Earned ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Distraction Trend" subtitle="Lower is better — stay consistent" delay={0.4}>
            {distractionTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={distractionTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="day" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#EF4444"
                    strokeWidth={2.5}
                    dot={{ fill: '#EF4444', r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, stroke: '#EF4444', strokeWidth: 2, fill: '#FFFFFF' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">
                No distraction data yet.
              </div>
            )}
          </ChartCard>

          <ChartCard title="Coins Earned" subtitle="Weekly Focus Coin accumulation" delay={0.5}>
            {coinsEarnedWeekly.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={coinsEarnedWeekly}>
                  <defs>
                    <linearGradient id="coinGradientNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="day" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="coins"
                    stroke="#8B5CF6"
                    strokeWidth={3}
                    fill="url(#coinGradientNew)"
                    dot={{ fill: '#8B5CF6', r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, stroke: '#8B5CF6', strokeWidth: 2, fill: '#FFFFFF' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">
                No coin data yet.
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </PageTransition>
  );
};

export default DashboardHome;
