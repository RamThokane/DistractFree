import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import CircularProgress from '../components/CircularProgress';
import AnimatedCounter from '../components/AnimatedCounter';
import PageTransition from '../components/PageTransition';
import { useAuth } from '../context/AuthContext';
import { mockDashboardStats } from '../utils/mockData';
import { formatMinutesToHours, getGreeting } from '../utils/helpers';
import {
  HiOutlineClock,
  HiOutlineFire,
  HiOutlineSparkles,
} from 'react-icons/hi2';

const stats = mockDashboardStats;

/* ── Custom Recharts Tooltip ── */
const CustomTooltip = memo(({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white/90 backdrop-blur-md border border-gray-100 rounded-2xl px-5 py-4 shadow-glass">
          <p className="text-gray-500 text-xs mb-1.5 uppercase tracking-wide">{label}</p>
          {payload.map((p, i) => (
            <p key={i} className="text-gray-900 text-sm font-semibold flex items-center gap-2">
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
const MetricCard = memo(({ icon: Icon, iconBg, iconColor, label, value, suffix, delay }) => (
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

/* ════════════ DASHBOARD HOME ════════════ */
const DashboardHome = () => {
  const { user } = useAuth();
  const progressPercent = (stats.todayFocusMinutes / stats.todayGoalMinutes) * 100;

  return (
    <PageTransition>
      <div className="space-y-8">
        {/* ── Greeting Section ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-sm text-gray-400 mb-1">{getGreeting()}</p>
          <h1 className="text-2xl md:text-[1.75rem] font-semibold text-gray-900 tracking-tight">
            {user?.name || 'User'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">Here's your productivity overview today.</p>
        </motion.div>

        {/* ── Metric Cards Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            icon={HiOutlineClock}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            label="Today's Focus Time"
            value={stats.todayFocusMinutes}
            suffix="min"
            delay={0}
          />
          <MetricCard
            icon={() => <span className="text-xl">🪙</span>}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
            label="Coins Earned Today"
            value={stats.coinsEarnedToday}
            delay={0.08}
          />
          <MetricCard
            icon={HiOutlineFire}
            iconBg="bg-orange-50"
            iconColor="text-orange-500"
            label="Current Streak"
            value={stats.currentStreak}
            suffix="days"
            delay={0.16}
          />
          <MetricCard
            icon={HiOutlineSparkles}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-500"
            label="AI Focus Score"
            value={stats.aiFocusScore}
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
                value={stats.todayFocusMinutes}
                max={stats.todayGoalMinutes}
                size={220}
                strokeWidth={16}
                color="#6366F1"
                label={formatMinutesToHours(stats.todayFocusMinutes)}
                sublabel={`of ${formatMinutesToHours(stats.todayGoalMinutes)} goal`}
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
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.weeklyFocusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="day"
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="minutes"
                  fill="#6366F1"
                  radius={[8, 8, 0, 0]}
                  barSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ── Secondary Analytics: Distraction Trend + Coins Earned ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distraction Trend Line Chart */}
          <ChartCard
            title="Distraction Trend"
            subtitle="Lower is better — stay consistent"
            delay={0.4}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.distractionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="day"
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
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
          </ChartCard>

          {/* Coins Earned Area Chart */}
          <ChartCard
            title="Coins Earned"
            subtitle="Weekly Focus Coin accumulation"
            delay={0.5}
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.coinsEarnedWeekly}>
                <defs>
                  <linearGradient id="coinGradientNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="day"
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
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
          </ChartCard>
        </div>
      </div>
    </PageTransition>
  );
};

export default DashboardHome;
