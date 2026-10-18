import React, { useState, useEffect, useCallback } from 'react';
import { Card, Select, Skeleton, EmptyState } from './ui';
import { LuGrid3X3 } from 'react-icons/lu';
import api from '../services/api';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ── One-hue scale: deeper green = more productive ── */
const scoreToColor = (score, hasData) => {
  if (!hasData) return 'var(--paper-3)';
  const steps = [[20, 0.14], [40, 0.28], [60, 0.45], [75, 0.62], [90, 0.8]];
  const alpha = (steps.find(([max]) => score < max) || [0, 1])[1];
  return `rgb(var(--c-accent) / ${alpha})`;
};

/* ── Tooltip ── */
const HeatmapTooltip = ({ cell, x, y }) => {
  if (!cell) return null;
  const d = new Date(cell.date);
  const formattedDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const rows = [
    ['Productivity', `${cell.score}%`],
    ['Distraction', `${cell.distractionScore}%`],
    ['Sessions', cell.completedSessions],
    ['Focus', `${cell.focusMinutes} min`],
  ];
  if (cell.blockedAttempts > 0) rows.push(['Blocked', cell.blockedAttempts]);

  return (
    <div className="fixed z-[100] pointer-events-none" style={{ left: x + 12, top: y - 10 }}>
      <div className="df-card shadow-pop px-4 py-3 min-w-[180px]">
        <p className="text-sm font-semibold text-text mb-1.5">{formattedDate}</p>
        <dl className="space-y-1 text-xs">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="df-mono text-text">{v}</dd></div>
          ))}
        </dl>
      </div>
    </div>
  );
};

/* ── Legend ── */
const Legend = () => (
  <div className="flex items-center gap-1.5 justify-end" aria-hidden="true">
    <span className="text-muted text-xs mr-1">Less</span>
    {[[0, false], [10, true], [30, true], [50, true], [70, true], [85, true], [95, true]].map(([s, has], i) => (
      <span key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: scoreToColor(s, has) }} />
    ))}
    <span className="text-muted text-xs ml-1">More</span>
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

  const yearPicker = (
    <Select
      label="Year"
      fieldClassName="w-32"
      value={selectedYear}
      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
      options={[...Array(5)].map((_, i) => { const y = new Date().getFullYear() - i; return { value: y, label: String(y) }; })}
    />
  );
  const head = (
    <div className="pg-head">
      <div>
        <p className="pg-kicker">Heatmap</p>
        <h2 className="pg-title">Your year in <em>focus</em></h2>
        <p className="pg-sub">Your productivity across the year</p>
      </div>
      {yearPicker}
    </div>
  );

  if (loading && !heatmap) {
    return (
      <div aria-busy="true" aria-label="Loading heatmap">
        {head}
        <Skeleton height={200} radius={10} />
      </div>
    );
  }

  if (!heatmap || heatmap.cells?.length === 0) {
    return (
      <div>
        {head}
        <EmptyState icon={LuGrid3X3} title={`Nothing for ${selectedYear} yet`}>
          No heatmap data found for {selectedYear}. Each day you focus adds a square here.
        </EmptyState>
      </div>
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
    <div>
      {head}

      {/* Grid */}
      <Card padding="p-6">
        <div className="overflow-x-auto overflow-y-hidden pb-2">
          <div className="min-w-max">
            {/* Month labels */}
            <div className="relative h-5 mb-1" style={{ marginLeft: 40 }} aria-hidden="true">
              {monthLabels.map((m, i) => (
                <span key={i} className="absolute df-mono text-[11px] text-muted" style={{ left: m.index * 18 }}>
                  {m.label}
                </span>
              ))}
            </div>

            {/* Grid Area */}
            <div className="flex gap-1">
              {/* Day Labels */}
              <div className="flex flex-col gap-1 pr-2" aria-hidden="true">
                {DAY_LABELS.map((day, i) => (
                  <div key={day} className="h-[14px] df-mono text-[10px] text-muted flex items-center justify-end w-6">
                    {i % 2 !== 0 ? day : ''}
                  </div>
                ))}
              </div>

              {/* Weeks */}
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-1">
                  {week.map((cell, dayIdx) => (
                    <div
                      key={dayIdx}
                      className={`w-[14px] h-[14px] rounded-[3px] ${cell ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-offset-1 hover:outline-text' : ''}`}
                      style={{ backgroundColor: cell ? scoreToColor(cell.score || 0, cell.hasData) : 'transparent' }}
                      title={cell ? `${cell.date.slice(0, 10)}: ${cell.score}% productive` : undefined}
                      onMouseEnter={(e) => cell && setTooltip({ cell, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e) => tooltip && setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-between items-center gap-6">
              <span className="text-xs text-muted">Data coverage: <span className="df-mono text-text">{heatmap.coverage}%</span></span>
              <Legend />
            </div>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <dl className="pg-stats pg-stats--3 mt-10">
        {[
          ['Best month', heatmap.bestMonth, null, 'text-accent'],
          ['Best week', heatmap.bestWeek, null, 'text-text'],
          ['Most productive day', heatmap.mostProductiveDay, 'Highest focus score', 'text-accent'],
          ['Highest distraction', heatmap.highestDistractionDay, 'Most blocked attempts', 'text-text'],
          ['Longest streak', `${heatmap.longestStreak} days`, 'Consecutive focused days', 'text-amber-ink'],
          ['Data coverage', `${heatmap.coverage}%`, 'Of the selected year', 'text-text'],
        ].map(([label, value, sub, tone], i) => (
          <div key={label} className={i >= 3 ? 'md:border-t md:border-line' : ''}>
            <dt className="df-label">{label}</dt>
            <dd className={`df-mono text-lg mt-1 ${tone}`}>{value || 'N/A'}</dd>
            {sub && <dd className="text-xs text-muted mt-0.5">{sub}</dd>}
          </div>
        ))}
      </dl>

      {/* Tooltip */}
      {tooltip && <HeatmapTooltip cell={tooltip.cell} x={tooltip.x} y={tooltip.y} />}
    </div>
  );
};

export default ProductivityHeatmap;
