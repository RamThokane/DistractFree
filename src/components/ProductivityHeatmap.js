import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import GlassCard from './GlassCard';
import api from '../services/api';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ── Color scale (dark theme) ── */
const scoreToColor = (score, hasData) => {
  if (!hasData) return 'rgba(255,255,255,0.02)';
  if (score === 0) return 'rgba(239,107,107,0.15)';
  if (score < 20) return 'rgba(239,107,107,0.35)';
  if (score < 40) return 'rgba(245,182,56,0.3)';
  if (score < 60) return 'rgba(245,182,56,0.5)';
  if (score < 75) return 'rgba(63,174,106,0.4)';
  if (score < 90) return 'rgba(63,174,106,0.6)';
  return 'rgba(63,174,106,0.85)';
};

/* ── Tooltip ── */
const HeatmapTooltip = ({ cell, x, y }) => {
  if (!cell) return null;
  const d = new Date(cell.date);
  const formattedDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed z-[100] pointer-events-none"
      style={{ left: x + 12, top: y - 10 }}
    >
      <div className="bg-[#14171C]/95 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 shadow-2xl min-w-[180px]">
        <p className="text-white font-semibold text-sm mb-1">{formattedDate}</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-gray-400">Productivity</span><span className="text-white font-medium">{cell.score}%</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Distraction</span><span className="text-red-400 font-medium">{cell.distractionScore}%</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Sessions</span><span className="text-white">{cell.completedSessions}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Focus</span><span className="text-white">{cell.focusMinutes} min</span></div>
          {cell.blockedAttempts > 0 && (
            <div className="flex justify-between"><span className="text-gray-400">Blocked</span><span className="text-red-400">{cell.blockedAttempts}</span></div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* ── Summary Card ── */
const SummaryCard = ({ icon, label, value, sublabel, color = '#F0EEFF' }) => (
  <GlassCard padding="p-4" className="text-center h-full">
    <span className="text-2xl">{icon}</span>
    <p className="text-[#8B8AA8] text-[10px] mt-2 uppercase tracking-wider">{label}</p>
    <p className="font-bold text-xl mt-0.5" style={{ color }}>{value || 'N/A'}</p>
    {sublabel && <p className="text-[#6B6A85] text-[10px] mt-1">{sublabel}</p>}
  </GlassCard>
);

/* ── Legend ── */
const Legend = () => (
  <div className="flex items-center gap-2 justify-end">
    <span className="text-[#6B6A85] text-xs">Less</span>
    {[0, 15, 35, 55, 72, 85, 95].map((s, i) => (
      <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: scoreToColor(s, true) }} />
    ))}
    <span className="text-[#6B6A85] text-xs">More</span>
  </div>
);

/* ════════════ MAIN COMPONENT ════════════ */
const ProductivityHeatmap = () => {
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fetchHeatmap = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/insights/heatmap/yearly', { params: { year: selectedYear } });
      if (res.data?.success) setHeatmap(res.data);
    } catch (err) {
      console.error('[Heatmap] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => { fetchHeatmap(); }, [fetchHeatmap]);

  if (loading && !heatmap) {
    return (
      <div className="animate-pulse">
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.04] h-[280px] mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="bg-white/[0.03] rounded-2xl border border-white/[0.04] h-24" />)}
        </div>
      </div>
    );
  }

  if (!heatmap || heatmap.cells?.length === 0) {
    return (
      <GlassCard>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <span className="text-4xl mb-3">📊</span>
          <p className="text-[#8B8AA8] text-sm max-w-sm leading-relaxed">
            No heatmap data found for {selectedYear}.
          </p>
        </div>
      </GlassCard>
    );
  }

  // 1. Group cells into weeks
  // A week array will contain 7 days (Sunday - Saturday)
  const weeks = [];
  let currentWeek = [];
  
  // Fill initial empty days if the year doesn't start on Sunday
  const firstDay = new Date(heatmap.cells[0].date).getUTCDay();
  for (let i = 0; i < firstDay; i++) {
    currentWeek.push(null);
  }

  heatmap.cells.forEach(cell => {
    currentWeek.push(cell);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  if (currentWeek.length > 0) {
    // Fill remaining days of the last week
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  // Calculate month labels positions
  const monthLabels = [];
  let currentMonth = -1;
  weeks.forEach((week, index) => {
    const firstValidDay = week.find(day => day !== null);
    if (firstValidDay) {
      const d = new Date(firstValidDay.date);
      if (d.getUTCMonth() !== currentMonth) {
        currentMonth = d.getUTCMonth();
        monthLabels.push({ label: MONTH_LABELS[currentMonth], index });
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-[#F0EEFF] font-semibold text-2xl mb-1 flex items-center gap-2">🗓️ Productivity Heatmap</h2>
          <p className="text-[#8B8AA8] text-sm">Your productivity across the year</p>
        </div>
        <div className="flex items-center gap-2 bg-[#14171C]/50 px-3 py-1.5 rounded-lg border border-white/5">
          <span className="text-[#8B8AA8] text-xs">Year:</span>
          <select 
            value={selectedYear} 
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            className="bg-transparent text-[#F0EEFF] text-sm font-semibold outline-none cursor-pointer"
          >
            {[...Array(5)].map((_, i) => {
              const y = new Date().getFullYear() - i;
              return <option key={y} value={y} className="bg-[#1C2028]">{y}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Grid */}
      <GlassCard padding="p-6">
        <div className="overflow-x-auto overflow-y-hidden custom-scrollbar pb-4">
          <div className="min-w-max">
            {/* Month labels */}
            <div className="flex mb-2" style={{ paddingLeft: '40px' }}>
              {monthLabels.map((m, i) => (
                <div 
                  key={i} 
                  className="absolute text-xs text-[#8B8AA8] font-medium"
                  style={{ left: `${m.index * 16 + 40}px` }}
                >
                  {m.label}
                </div>
              ))}
              <div className="h-4" /> {/* Spacer for absolute labels */}
            </div>

            {/* Grid Area */}
            <div className="flex gap-1">
              {/* Day Labels */}
              <div className="flex flex-col gap-1 pr-2 mt-[2px]">
                {DAY_LABELS.map((day, i) => (
                  <div key={day} className="h-[14px] text-[10px] text-[#6B6A85] font-medium flex items-center justify-end w-6">
                    {i % 2 !== 0 ? day : ''}
                  </div>
                ))}
              </div>

              {/* Weeks */}
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-1">
                  {week.map((cell, dayIdx) => (
                    <motion.div
                      key={dayIdx}
                      className="w-[14px] h-[14px] rounded-[3px] transition-all relative"
                      style={{
                        backgroundColor: scoreToColor(cell?.score || 0, cell?.hasData),
                        outline: cell ? 'none' : '1px solid rgba(255,255,255,0.02)',
                        cursor: cell ? 'pointer' : 'default'
                      }}
                      whileHover={cell ? { scale: 1.3, zIndex: 10 } : {}}
                      onMouseEnter={(e) => cell && setTooltip({ cell, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e) => tooltip && setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-[#6B6A85] text-xs font-medium">Data Coverage: <span className="text-[#3FAE6A]">{heatmap.coverage}%</span></span>
              </div>
              <Legend />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-4">
        <SummaryCard icon="🏆" label="Best Month" value={heatmap.bestMonth} color="#3FAE6A" />
        <SummaryCard icon="📅" label="Best Week" value={heatmap.bestWeek} color="#7C5CFC" />
        <SummaryCard icon="🔥" label="Most Productive Day" value={heatmap.mostProductiveDay} color="#3FAE6A" sublabel="Highest focus score" />
        <SummaryCard icon="⚠️" label="Highest Distraction" value={heatmap.highestDistractionDay} color="#EF6B6B" sublabel="Most blocked attempts" />
        <SummaryCard icon="⚡" label="Longest Streak" value={`${heatmap.longestStreak} days`} color="#F5B638" sublabel="Consecutive focused days" />
        <SummaryCard icon="📊" label="Data Coverage" value={`${heatmap.coverage}%`} color="#60A5FA" sublabel="Of the selected year" />
      </div>

      {/* Tooltip */}
      {tooltip && <HeatmapTooltip cell={tooltip.cell} x={tooltip.x} y={tooltip.y} />}
    </div>
  );
};

export default ProductivityHeatmap;
