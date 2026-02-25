import React from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import GlassCard from '../components/GlassCard';
import CircularProgress from '../components/CircularProgress';
import AnimatedCounter from '../components/AnimatedCounter';
import PageTransition from '../components/PageTransition';
import { mockDashboardStats } from '../utils/mockData';
import { formatMinutesToHours } from '../utils/helpers';
import { HiOutlineClock, HiOutlineFire, HiOutlineSparkles } from 'react-icons/hi2';

const stats = mockDashboardStats;

/* ── Custom Recharts tooltip ── */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-dash-border rounded-xl px-4 py-3 shadow-lg">
        <p className="text-dash-muted text-xs mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-dash-text text-sm font-semibold">
            {p.name}: {p.value}{p.name === 'minutes' ? ' min' : ''}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/* ── Stat Card Component ── */
const StatCard = ({ icon: Icon, iconBg, label, value, suffix, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
  >
    <GlassCard className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-dash-muted text-xs">{label}</p>
        <div className="flex items-baseline gap-1">
          <AnimatedCounter value={value} className="text-2xl font-bold text-dash-text" />
          {suffix && <span className="text-dash-muted text-sm">{suffix}</span>}
        </div>
      </div>
    </GlassCard>
  </motion.div>
);

/* ════════════ DASHBOARD HOME ════════════ */
const DashboardHome = () => {
  const progressPercent = (stats.todayFocusMinutes / stats.todayGoalMinutes) * 100;

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* ── Top Stats Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={HiOutlineClock}
            iconBg="bg-sage-50 text-sage"
            label="Today's Focus Time"
            value={stats.todayFocusMinutes}
            suffix="min"
            delay={0}
          />
          <StatCard
            icon={() => <span className="text-xl">🪙</span>}
            iconBg="bg-amber-50 text-amber-500"
            label="Coins Earned Today"
            value={stats.coinsEarnedToday}
            delay={0.1}
          />
          <StatCard
            icon={HiOutlineFire}
            iconBg="bg-orange-50 text-orange-500"
            label="Current Streak"
            value={stats.currentStreak}
            suffix="days"
            delay={0.2}
          />
          <StatCard
            icon={HiOutlineSparkles}
            iconBg="bg-indigo-50 text-indigo-500"
            label="AI Focus Score"
            value={stats.aiFocusScore}
            suffix="/100"
            delay={0.3}
          />
        </div>

        {/* ── Focus Progress Ring + Quick Info ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <GlassCard className="flex flex-col items-center justify-center py-8">
              <CircularProgress
                value={stats.todayFocusMinutes}
                max={stats.todayGoalMinutes}
                size={180}
                strokeWidth={12}
                color="#3FAE6A"
                label={formatMinutesToHours(stats.todayFocusMinutes)}
                sublabel={`of ${formatMinutesToHours(stats.todayGoalMinutes)} goal`}
              />
              <p className="text-dash-muted text-sm mt-4">Daily Focus Progress</p>
              <div className="mt-3 bg-sage-50 border border-sage-100 rounded-full px-4 py-1">
                <span className="text-sage font-medium text-sm">{Math.round(progressPercent)}% Complete</span>
              </div>
            </GlassCard>
          </motion.div>

          {/* Weekly Focus Bar Chart */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <GlassCard>
              <h3 className="text-dash-text font-semibold text-lg mb-1">Weekly Focus Time</h3>
              <p className="text-dash-muted text-sm mb-4">Minutes per day this week</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.weeklyFocusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EBF0" />
                  <XAxis dataKey="day" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="minutes" fill="#3FAE6A" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>
          </motion.div>
        </div>

        {/* ── Bottom Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Distraction Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <GlassCard>
              <h3 className="text-dash-text font-semibold text-lg mb-1">Distraction Trend</h3>
              <p className="text-dash-muted text-sm mb-4">Lower is better — stay consistent</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.distractionTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EBF0" />
                  <XAxis dataKey="day" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#EF6B6B"
                    strokeWidth={2}
                    dot={{ fill: '#EF6B6B', r: 3.5, strokeWidth: 0 }}
                    activeDot={{ r: 5, stroke: '#EF6B6B', strokeWidth: 2, fill: '#FFFFFF' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </GlassCard>
          </motion.div>

          {/* Coins Earned Area */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <GlassCard>
              <h3 className="text-dash-text font-semibold text-lg mb-1">Coins Earned</h3>
              <p className="text-dash-muted text-sm mb-4">Weekly Focus Coin accumulation</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.coinsEarnedWeekly}>
                  <defs>
                    <linearGradient id="coinGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3FAE6A" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3FAE6A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EBF0" />
                  <XAxis dataKey="day" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="coins"
                    stroke="#3FAE6A"
                    strokeWidth={2}
                    fill="url(#coinGradient)"
                    dot={{ fill: '#3FAE6A', r: 3.5, strokeWidth: 0 }}
                    activeDot={{ r: 5, stroke: '#3FAE6A', strokeWidth: 2, fill: '#FFFFFF' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
};

export default DashboardHome;
