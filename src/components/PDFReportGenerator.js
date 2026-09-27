import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import api from '../services/api';
import { HiOutlineDownload } from 'react-icons/hi';

/*
 * Weekly Productivity Report — built as a native, print-friendly PDF
 * (real text + vector tables/charts, proper page breaks) from live data.
 */

const COLORS = {
  ink: [17, 24, 39],
  muted: [107, 114, 128],
  line: [229, 231, 235],
  soft: [247, 248, 252],
  accent: [124, 92, 252],
  green: [63, 174, 106],
  amber: [245, 182, 56],
  red: [239, 107, 107],
};
const RISK_COLOR = { low: COLORS.green, medium: COLORS.amber, high: COLORS.red };
const RISK_MEANING = {
  low: 'You usually stay on task.',
  medium: 'Some distractions are likely.',
  high: 'Distractions are very likely next session.',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtTime = (d) => new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const localDay = (d) => new Date(d).toLocaleDateString('en-CA');

async function fetchAll(path, key, maxPages = 5) {
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await api.get(path, { params: { page, limit: 50 } }).catch(() => null);
    const batch = res?.data?.[key] || [];
    items.push(...batch);
    if (!res?.data?.pagination || page >= res.data.pagination.pages) break;
  }
  return items;
}

/** Small layout engine: tracks the cursor and adds pages as needed. */
function createDoc() {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 16; // margin
  let y = M;

  const setColor = (c) => pdf.setTextColor(...c);
  const ensure = (h) => {
    if (y + h > H - 18) {
      pdf.addPage();
      y = M;
    }
  };

  const heading = (text) => {
    ensure(16);
    y += 4;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    setColor(COLORS.ink);
    pdf.text(text, M, y);
    pdf.setDrawColor(...COLORS.accent);
    pdf.setLineWidth(0.6);
    pdf.line(M, y + 2, M + 14, y + 2);
    y += 8;
  };

  const paragraph = (text, size = 9.5, color = COLORS.muted) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(size);
    setColor(color);
    const lines = pdf.splitTextToSize(text, W - 2 * M);
    ensure(lines.length * 4.6);
    pdf.text(lines, M, y);
    y += lines.length * 4.6 + 1.5;
  };

  const kpis = (items) => {
    const cols = 4;
    const gap = 4;
    const w = (W - 2 * M - gap * (cols - 1)) / cols;
    const h = 20;
    for (let i = 0; i < items.length; i += cols) {
      ensure(h + gap);
      items.slice(i, i + cols).forEach((k, j) => {
        const x = M + j * (w + gap);
        pdf.setFillColor(...COLORS.soft);
        pdf.setDrawColor(...COLORS.line);
        pdf.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        setColor(COLORS.muted);
        pdf.text(k.label.toUpperCase(), x + 3.5, y + 6);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13);
        setColor(k.color || COLORS.ink);
        pdf.text(String(k.value), x + 3.5, y + 13.5);
        if (k.sub) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(6.8);
          setColor(COLORS.muted);
          pdf.text(k.sub, x + 3.5, y + 17.5);
        }
      });
      y += h + gap;
    }
  };

  const keyValues = (rows) => {
    rows.forEach(([k, v, color]) => {
      ensure(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      setColor(COLORS.muted);
      pdf.text(k, M, y);
      pdf.setFont('helvetica', 'bold');
      setColor(color || COLORS.ink);
      pdf.text(String(v), W - M, y, { align: 'right' });
      pdf.setDrawColor(...COLORS.line);
      pdf.setLineWidth(0.2);
      pdf.line(M, y + 2.2, W - M, y + 2.2);
      y += 7;
    });
    y += 2;
  };

  /** columns: [{ title, width (fraction), align }] */
  const table = (columns, rows, emptyText = 'No data for this period.') => {
    const totalW = W - 2 * M;
    const rowH = 7;
    const drawHeader = () => {
      pdf.setFillColor(...COLORS.soft);
      pdf.rect(M, y, totalW, rowH, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      setColor(COLORS.muted);
      let x = M;
      columns.forEach((c) => {
        const w = c.width * totalW;
        const tx = c.align === 'right' ? x + w - 2 : x + 2;
        pdf.text(c.title.toUpperCase(), tx, y + 4.7, { align: c.align === 'right' ? 'right' : 'left' });
        x += w;
      });
      y += rowH;
    };

    ensure(rowH * 2);
    drawHeader();
    if (rows.length === 0) {
      paragraph(emptyText, 9);
      return;
    }
    rows.forEach((row) => {
      if (y + rowH > pdf.internal.pageSize.getHeight() - 18) {
        pdf.addPage();
        y = M;
        drawHeader();
      }
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      let x = M;
      columns.forEach((c, i) => {
        const w = c.width * totalW;
        const cell = row[i];
        const text = cell && typeof cell === 'object' ? cell.text : String(cell ?? '');
        setColor(cell && typeof cell === 'object' && cell.color ? cell.color : COLORS.ink);
        const clipped = pdf.splitTextToSize(text, w - 4)[0] || '';
        const tx = c.align === 'right' ? x + w - 2 : x + 2;
        pdf.text(clipped, tx, y + 4.7, { align: c.align === 'right' ? 'right' : 'left' });
        x += w;
      });
      pdf.setDrawColor(...COLORS.line);
      pdf.setLineWidth(0.15);
      pdf.line(M, y + rowH, M + totalW, y + rowH);
      y += rowH;
    });
    y += 3;
  };

  const barChart = (data, valueKey, labelKey, color = COLORS.accent) => {
    const h = 48;
    ensure(h + 10);
    const chartW = W - 2 * M;
    const max = Math.max(1, ...data.map((d) => d[valueKey]));
    const slot = chartW / data.length;
    const barW = Math.min(14, slot * 0.55);
    pdf.setDrawColor(...COLORS.line);
    pdf.setLineWidth(0.2);
    pdf.line(M, y + h, M + chartW, y + h);
    data.forEach((d, i) => {
      const v = d[valueKey];
      const bh = (v / max) * (h - 8);
      const x = M + i * slot + (slot - barW) / 2;
      pdf.setFillColor(...color);
      if (bh > 0) pdf.roundedRect(x, y + h - bh, barW, bh, 1, 1, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      setColor(COLORS.ink);
      pdf.text(String(v), x + barW / 2, y + h - bh - 1.5, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      setColor(COLORS.muted);
      pdf.text(d[labelKey], x + barW / 2, y + h + 4.5, { align: 'center' });
    });
    y += h + 9;
  };

  const footer = (name) => {
    const pages = pdf.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      pdf.setPage(p);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      setColor(COLORS.muted);
      pdf.text(`DistractFree Weekly Report - ${name}`, M, H - 8);
      pdf.text(`Page ${p} of ${pages}`, W - M, H - 8, { align: 'right' });
    }
  };

  return {
    pdf, W, M, heading, paragraph, kpis, keyValues, table, barChart, footer,
    get y() { return y; },
    set y(v) { y = v; },
  };
}

const PDFReportGenerator = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generatePDF = async () => {
    try {
      setLoading(true);
      setError('');
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const since = new Date(Date.now() - 7 * DAY_MS);

      const [insightsRes, balanceRes, sessions, transactions] = await Promise.all([
        api.get(`/insights/full?tz=${encodeURIComponent(tz)}`).catch(() => null),
        api.get('/coins/balance').catch(() => null),
        fetchAll('/session/history', 'sessions'),
        fetchAll('/coins/history', 'transactions'),
      ]);

      const ins = insightsRes?.data || {};
      const f = ins.features || {};
      const pred = ins.prediction || {};
      const prod = ins.productivityWindows || {};
      const dist = ins.distractionHours || {};
      const trends = ins.trends || {};
      const bal = balanceRes?.data || {};

      const weekSessions = sessions.filter((s) => new Date(s.startTime) >= since && s.status !== 'active');
      const completed = weekSessions.filter((s) => s.status === 'completed');
      const weekTx = transactions.filter((t) => new Date(t.createdAt) >= since);
      const coinsEarned = weekTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const coinsSpent = weekTx.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
      const focusMinutes = completed.reduce((s, x) => s + (x.duration || 0), 0);
      const avgSession = completed.length ? Math.round(focusMinutes / completed.length) : 0;
      const completionRate = weekSessions.length ? Math.round((completed.length / weekSessions.length) * 100) : 0;
      const distractions = weekSessions.reduce((s, x) => s + (x.distractionAttempts || 0), 0);

      // Per-day breakdown (local dates)
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * DAY_MS);
        const key = localDay(d);
        const daySessions = weekSessions.filter((s) => localDay(s.startTime) === key);
        const dayDone = daySessions.filter((s) => s.status === 'completed');
        days.push({
          label: d.toLocaleDateString(undefined, { weekday: 'short' }),
          date: fmtDate(d),
          sessions: daySessions.length,
          completed: dayDone.length,
          minutes: dayDone.reduce((s, x) => s + (x.duration || 0), 0),
          distractions: daySessions.reduce((s, x) => s + (x.distractionAttempts || 0), 0),
          coins: dayDone.reduce((s, x) => s + (x.coinsEarned || 0), 0),
        });
      }

      const doc = createDoc();
      const { pdf, W, M } = doc;
      const name = user?.name || 'User';

      // ── Title block ──
      pdf.setFillColor(...COLORS.accent);
      pdf.rect(0, 0, W, 34, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(19);
      pdf.text('Weekly Productivity Report', M, 16);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`${name}  |  ${fmtDate(since)} - ${fmtDate(new Date())}`, M, 24);
      pdf.setFontSize(8);
      pdf.text(`Generated ${new Date().toLocaleString()}`, M, 29.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(22);
      pdf.text(`${pred.focusScore ?? 0}`, W - M - 14, 18, { align: 'right' });
      pdf.setFontSize(9);
      pdf.text('/100', W - M, 18, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.text('FOCUS SCORE', W - M, 24, { align: 'right' });
      doc.y = 44;

      // ── 1. Summary ──
      doc.heading('1. Weekly Summary');
      doc.kpis([
        { label: 'Focus time', value: fmtMin(focusMinutes), sub: `${completed.length} completed sessions` },
        { label: 'Completion rate', value: `${completionRate}%`, sub: `${weekSessions.length} sessions started`, color: completionRate >= 70 ? COLORS.green : COLORS.amber },
        { label: 'Avg session', value: `${avgSession} min`, sub: `Optimal: ${prod.optimalSessionLength || 25} min` },
        { label: 'Blocked attempts', value: distractions, sub: 'During focus sessions', color: distractions > 0 ? COLORS.red : COLORS.green },
        { label: 'Current streak', value: `${bal.currentStreak ?? user?.currentStreak ?? 0} days`, sub: `Longest: ${bal.longestStreak ?? 0} days` },
        { label: 'Coins earned', value: `+${coinsEarned}`, sub: 'This week', color: COLORS.green },
        { label: 'Coins spent', value: `-${coinsSpent}`, sub: 'Unlocks & penalties', color: coinsSpent > 0 ? COLORS.red : COLORS.ink },
        { label: 'Coin balance', value: bal.focusCoins ?? user?.focusCoins ?? 0, sub: 'Available now' },
      ]);

      // ── 2. Daily breakdown ──
      doc.heading('2. Daily Focus Minutes');
      doc.barChart(days, 'minutes', 'label');
      doc.table(
        [
          { title: 'Day', width: 0.28 },
          { title: 'Sessions', width: 0.14, align: 'right' },
          { title: 'Completed', width: 0.14, align: 'right' },
          { title: 'Focus time', width: 0.16, align: 'right' },
          { title: 'Blocked', width: 0.14, align: 'right' },
          { title: 'Coins', width: 0.14, align: 'right' },
        ],
        days.map((d) => [d.date, d.sessions, d.completed, fmtMin(d.minutes), { text: String(d.distractions), color: d.distractions ? COLORS.red : COLORS.ink }, d.coins])
      );

      // ── 3. AI insights ──
      doc.heading('3. AI Focus Analysis');
      const risk = pred.riskLevel || 'n/a';
      doc.keyValues([
        ['Predicted distraction risk', `${risk.toUpperCase()}${RISK_MEANING[risk] ? ` - ${RISK_MEANING[risk]}` : ''}`, RISK_COLOR[risk]],
        ['Focus score (7-day)', `${pred.focusScore ?? 0} / 100`, COLORS.green],
        ['Distraction score (100 - focus)', `${pred.distractionScore ?? 0} / 100`, COLORS.red],
        ['Best focus window', prod.bestFocusHours || 'Not enough data'],
        ['Weakest window', prod.weakestHours || 'Not enough data'],
        ['Peak distraction window', dist.peakDistractionWindow || 'None detected'],
        ['Tab switches per session', f.tabSwitchCount ?? 0],
        ['Blocked visit ratio', `${f.blockedVisitRatio ?? 0}%`],
      ]);
      if (pred.explanation) doc.paragraph(pred.explanation);

      if (dist.topRiskHours?.length) {
        doc.table(
          [
            { title: 'High-risk hour', width: 0.4 },
            { title: 'Risk', width: 0.2, align: 'right' },
            { title: 'Blocked attempts', width: 0.2, align: 'right' },
            { title: 'Sessions', width: 0.2, align: 'right' },
          ],
          dist.topRiskHours.map((h) => [h.window || h.label, { text: `${h.riskPercent}%`, color: h.riskPercent > 60 ? COLORS.red : COLORS.amber }, h.blockedAttempts, h.sessions ?? 0])
        );
      }

      // ── 4. Sites ──
      doc.heading('4. Most Visited Sites');
      doc.table(
        [
          { title: 'Website', width: 0.46 },
          { title: 'Visits', width: 0.18, align: 'right' },
          { title: 'Blocked', width: 0.18, align: 'right' },
          { title: 'Time', width: 0.18, align: 'right' },
        ],
        (ins.topSites || []).slice(0, 10).map((s) => [s._id, s.visits, { text: String(s.blockedVisits), color: s.blockedVisits ? COLORS.red : COLORS.ink }, fmtMin(Math.round((s.totalDuration || 0) / 60))])
      );

      // ── 5. Session log ──
      doc.heading('5. Session Log');
      doc.table(
        [
          { title: 'Date', width: 0.2 },
          { title: 'Start', width: 0.12 },
          { title: 'Planned', width: 0.11, align: 'right' },
          { title: 'Actual', width: 0.11, align: 'right' },
          { title: 'Status', width: 0.14 },
          { title: 'Blocked', width: 0.1, align: 'right' },
          { title: 'Tabs', width: 0.08, align: 'right' },
          { title: 'Coins', width: 0.14, align: 'right' },
        ],
        weekSessions.map((s) => [
          fmtDate(s.startTime),
          fmtTime(s.startTime),
          `${s.plannedDuration}m`,
          `${s.duration || 0}m`,
          { text: s.status, color: s.status === 'completed' ? COLORS.green : COLORS.red },
          s.distractionAttempts || 0,
          s.tabSwitches || 0,
          s.coinsEarned || 0,
        ]),
        'No sessions in the last 7 days.'
      );

      // ── 6. Recommendations ──
      doc.heading('6. Recommendations');
      if (ins.sessionRecommendation) {
        doc.paragraph(
          `Session plan: ${ins.sessionRecommendation.recommendedSessionTime}-minute focus blocks followed by ${ins.sessionRecommendation.suggestedBreakTime}-minute breaks.`,
          10,
          COLORS.ink
        );
      }
      const recs = ins.recommendations || [];
      if (recs.length === 0) doc.paragraph('Keep completing sessions to unlock personalised recommendations.');
      recs.slice(0, 6).forEach((r, i) => {
        doc.paragraph(`${i + 1}. ${r.title} (${r.priority} priority)`, 10, COLORS.ink);
        doc.paragraph(r.description);
      });

      doc.footer(name);
      pdf.save(`DistractFree_Weekly_Report_${localDay(new Date())}.pdf`);
    } catch (err) {
      console.error('PDF Generation Failed:', err);
      setError('Could not generate the report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ml-4 flex flex-col items-end">
      <button
        onClick={generatePDF}
        disabled={loading}
        className="text-xs text-white bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <HiOutlineDownload className="w-3.5 h-3.5" />
        )}
        {loading ? 'Generating...' : 'Download PDF Report'}
      </button>
      {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
    </div>
  );
};

export default PDFReportGenerator;
