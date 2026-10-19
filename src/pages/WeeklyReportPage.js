import React, { useCallback, useState } from 'react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import PageTransition from '../components/PageTransition';
import WeeklyReportCard from '../components/WeeklyReportCard';
import { Button } from '../components/ui';

const MAX_WEEKS_BACK = 12; // same limit as the server

/** "2026-10-12" ± days, as YYYY-MM-DD (calendar dates, so no timezone shift). */
function shiftDate(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Weekly report — last week's AI report (Monday to Sunday in your timezone),
 * with earlier weeks one click away.
 */
const WeeklyReportPage = () => {
  const [week, setWeek] = useState('latest');
  const [latestStart, setLatestStart] = useState(null); // Monday of the last finished week
  const [shownStart, setShownStart] = useState(null);

  const onLoad = useCallback((data) => {
    if (data.weekStart) setShownStart(data.weekStart);
    if (week === 'latest' && data.weekStart) setLatestStart(data.weekStart);
  }, [week]);

  const current = week === 'latest' ? latestStart : week;
  const weeksBack = latestStart && current ? Math.round((Date.parse(latestStart) - Date.parse(current)) / (7 * 864e5)) : 0;
  const canGoBack = Boolean(current) && weeksBack < MAX_WEEKS_BACK;
  const canGoForward = Boolean(current) && weeksBack > 0;

  const go = (days) => {
    const next = shiftDate(current, days);
    setShownStart(null);
    setWeek(next === latestStart ? 'latest' : next);
  };

  return (
    <PageTransition>
      <div className="pg-head">
        <div>
          <p className="pg-kicker">Monday to Sunday · your timezone</p>
          <h2 className="pg-title">Weekly <em>report</em></h2>
          <p className="pg-sub">How your week went, what to keep and what to change, written from your own numbers.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<LuChevronLeft size={16} aria-hidden="true" />} onClick={() => go(-7)} disabled={!canGoBack}>
            Earlier week
          </Button>
          <Button variant="secondary" size="sm" iconRight={<LuChevronRight size={16} aria-hidden="true" />} onClick={() => go(7)} disabled={!canGoForward}>
            {weeksBack === 1 ? 'Last week' : 'Later week'}
          </Button>
        </div>
      </div>
      <WeeklyReportCard key={week} week={week} onLoad={onLoad} />
      {shownStart && weeksBack > 0 && (
        <p className="pg-note mt-4">
          Showing an earlier week. <button type="button" className="df-link" onClick={() => setWeek('latest')}>Back to last week</button>
        </p>
      )}
    </PageTransition>
  );
};

export default WeeklyReportPage;
