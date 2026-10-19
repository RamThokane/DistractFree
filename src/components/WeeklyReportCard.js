import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LuCalendarPlus, LuMessageCircle, LuTrendingUp, LuTrendingDown, LuCalendarRange } from 'react-icons/lu';
import { agentService } from '../services/endpoints';
import ScheduleModal from './ScheduleModal';
import { Button, Card, EmptyState, Skeleton, SkeletonText, useToast } from './ui';
import { formatWhen } from '../utils/schedule';
import { formatMinutesToHours } from '../utils/helpers';

const RETRY_MS = 6000;
const MAX_RETRIES = 5;

/**
 * A week's AI report (GET /agent/weekly-report): headline, numbers, what went
 * well, what slipped, and one goal, which can be scheduled. Weeks run Monday
 * to Sunday in the user's timezone.
 *
 * @param {string}   [week]   'latest' (last finished week) or the Monday it starts, YYYY-MM-DD
 * @param {Function} [onLoad] called with the response, e.g. to page between weeks
 */
const WeeklyReportCard = ({ week = 'latest', onLoad }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const retries = useRef(0);

  const load = useCallback(async () => {
    try {
      setError(false);
      const res = await agentService.weeklyReport(week);
      setData(res.data);
      onLoad?.(res.data);
    } catch {
      setError(true);
    }
  }, [week, onLoad]);

  useEffect(() => {
    retries.current = 0;
    setData(null);
    load();
  }, [load]);

  // Another request is writing it: check back shortly
  useEffect(() => {
    if (data?.status !== 'generating' || retries.current >= MAX_RETRIES) return undefined;
    retries.current += 1;
    const id = setTimeout(load, RETRY_MS);
    return () => clearTimeout(id);
  }, [data, load]);

  if (error) {
    return (
      <Card variant="band" padding="p-6">
        <p className="df-label">Last week</p>
        <p className="text-sm text-muted mt-2">Couldn’t load your weekly report. <button type="button" className="df-link" onClick={load}>Try again</button></p>
      </Card>
    );
  }

  if (!data || data.status === 'generating') {
    return (
      <Card variant="band" padding="p-6 md:p-8" aria-busy="true">
        <p className="df-label">{data ? `Writing your report for ${data.weekLabel}…` : 'Last week'}</p>
        <Skeleton className="mt-4" width="65%" height={28} />
        <SkeletonText className="mt-5" lines={3} />
      </Card>
    );
  }

  if (data.status !== 'ready') {
    return (
      <EmptyState icon={LuCalendarRange} title="No report for this week">
        {data.reason || 'There is no report for this week.'}
      </EmptyState>
    );
  }

  const { facts: f, report: r, weekLabel } = data;
  // An earlier week: its goal was for the week after it, and the streak is today's, so leave both out
  const isPast = week !== 'latest';
  const slot = !isPast && r.goal?.suggestedSlot?.startAt ? r.goal.suggestedSlot : null;
  const change = f.changePercent;

  return (
    <>
      <Card variant="band" padding="p-6 md:p-8" aria-labelledby="weekly-report-title">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="df-label">Your week · {weekLabel}</p>
          <p className="text-xs text-muted">{data.source === 'gemini' ? 'Written by Gemini from your numbers' : 'From your numbers'}</p>
        </div>
        <h3 id="weekly-report-title" className="df-display text-t-28 md:text-t-40 mt-3 leading-tight max-w-3xl">{r.headline}</h3>

        <div className="pg-stats pg-stats--4 mt-6">
          <div>
            <p className="df-label">Focus time</p>
            <p className="df-mono text-t-28 text-text mt-1">{formatMinutesToHours(f.focusMinutes)}</p>
            {change !== null && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${change >= 0 ? 'text-accent' : 'text-danger'}`}>
                {change >= 0 ? <LuTrendingUp size={12} aria-hidden="true" /> : <LuTrendingDown size={12} aria-hidden="true" />}
                {change >= 0 ? '+' : '−'}{Math.abs(change)}% vs week before
              </p>
            )}
          </div>
          <div>
            <p className="df-label">Sessions</p>
            <p className="df-mono text-t-28 text-text mt-1">{f.sessions}</p>
            <p className="text-xs text-muted mt-1">{f.daysFocused} of 7 days</p>
          </div>
          <div>
            <p className="df-label">Went to plan</p>
            <p className="df-mono text-t-28 text-text mt-1">{f.wentToPlanPercent ?? 0}%</p>
            <p className="text-xs text-muted mt-1">{f.wentToPlan} of {f.sessions}</p>
          </div>
          {isPast ? (
            <div>
              <p className="df-label">Blocked attempts</p>
              <p className="df-mono text-t-28 text-text mt-1">{f.blockedAttempts}</p>
            </div>
          ) : (
            <div>
              <p className="df-label">Streak</p>
              <p className="df-mono text-t-28 text-text mt-1">{f.currentStreakDays}<span className="text-sm text-muted ml-1.5">days</span></p>
            </div>
          )}
        </div>

        {(r.wins.length > 0 || r.slips.length > 0) && (
          <div className="grid sm:grid-cols-2 gap-6 mt-6">
            {r.wins.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-text">What went well</h4>
                <ul className="agent-list text-sm text-text-2 mt-2 space-y-1">{r.wins.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            )}
            {r.slips.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-text">What slipped</h4>
                <ul className="agent-list text-sm text-text-2 mt-2 space-y-1">{r.slips.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-line flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0">
            <p className="df-label">{isPast ? 'Goal set for the week after' : 'Goal for this week'}</p>
            <p className="text-base text-text mt-1">{r.goal.text}</p>
            {slot && <p className="text-xs text-muted mt-1">Suggested: {formatWhen(slot.startAt)} · {slot.plannedDuration} min</p>}
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            {slot && (
              <Button size="sm" icon={<LuCalendarPlus size={14} aria-hidden="true" />} onClick={() => setScheduling(true)}>
                Schedule this
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              icon={<LuMessageCircle size={14} aria-hidden="true" />}
              onClick={() => navigate('/dashboard/coach', { state: { ask: `Talk me through my weekly report for ${weekLabel} (the week starting ${data.weekStart}). What should I change this week?` } })}
            >
              Ask the coach
            </Button>
          </div>
        </div>
      </Card>

      <AnimatePresence>
        {scheduling && slot && (
          <ScheduleModal
            start={new Date(slot.startAt)}
            defaultDuration={slot.plannedDuration}
            defaultTitle="Weekly goal"
            onClose={() => setScheduling(false)}
            onSaved={() => {
              setScheduling(false);
              toast.success('Session scheduled', `${formatWhen(slot.startAt)}. It starts automatically.`);
              window.dispatchEvent(new CustomEvent('DF_SCHEDULE_CHANGED'));
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default WeeklyReportCard;
