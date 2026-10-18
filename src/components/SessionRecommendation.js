import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { LuCalendarPlus, LuPlay, LuSparkles } from 'react-icons/lu';
import api from '../services/api';
import ScheduleModal from './ScheduleModal';
import { Button, Card, ProgressBar, Skeleton, SkeletonText, useToast } from './ui';

/**
 * "When should I focus next, and for how long?" — the best of ~90 options
 * (start times in the next 24 h × 25/40/60/90/120 min), from
 * GET /insights/recommendation. Schedule it, or start it if it's now.
 */
const SessionRecommendation = ({ compact = false }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [rec, setRec] = useState(null);
  const [error, setError] = useState(false);
  const [scheduling, setScheduling] = useState(null); // option being scheduled

  const load = useCallback(async () => {
    try {
      setError(false);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await api.get('/insights/recommendation', { params: { tz } });
      setRec(res.data.recommendation);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = (option) => {
    if (option.isNow) navigate(`/dashboard/focus?minutes=${option.plannedDuration}`);
    else setScheduling(option);
  };

  if (error) {
    return (
      <Card variant="band" padding="p-6">
        <p className="df-label">Best next session</p>
        <p className="text-sm text-muted mt-2">Couldn’t work out a suggestion right now. <button className="df-link" onClick={load}>Try again</button></p>
      </Card>
    );
  }

  if (!rec) {
    return (
      <Card variant="band" padding="p-6" aria-busy="true">
        <Skeleton width={140} height={12} />
        <Skeleton className="mt-4" width="70%" height={32} />
        <SkeletonText className="mt-5" lines={2} />
      </Card>
    );
  }

  if (rec.status !== 'ready') {
    return (
      <Card variant="band" padding="p-6">
        <p className="df-label">Best next session</p>
        <p className="df-display text-t-28 mt-2">Still learning your rhythm</p>
        <p className="text-sm text-muted mt-2 max-w-prose">{rec.message}</p>
        <ProgressBar className="mt-4 max-w-sm" label="Sessions so far" valueLabel={`${rec.basedOn} / ${rec.needed}`} value={rec.basedOn} max={rec.needed} />
      </Card>
    );
  }

  const { best, soonest, otherLength, why, basedOn, source } = rec;
  const tone = best.successPercent >= 65 ? 'accent' : best.successPercent >= 40 ? 'amber' : 'danger';

  return (
    <>
      <Card variant="band" padding={compact ? 'p-6' : 'p-6 md:p-8'}>
        <div className="grid md:grid-cols-12 gap-6 md:gap-8 items-start">
          <div className="md:col-span-8">
            <p className="df-label flex items-center gap-2"><LuSparkles className="text-accent" aria-hidden="true" />Best next session</p>
            <h3 className="df-display text-t-28 md:text-t-40 mt-3 leading-tight">{best.headline}.</h3>
            <ul className="mt-4 space-y-1.5">
              {why.map((line) => (
                <li key={line} className="text-sm text-text-2 flex gap-2"><span className="text-muted" aria-hidden="true">—</span>{line}</li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-4 md:text-right">
            <p className="df-mono text-t-64 leading-none text-text">
              {best.successPercent}<span className="text-t-28 text-muted">%</span>
            </p>
            <p className="text-sm text-muted mt-1">chance it goes to plan</p>
            <ProgressBar className="mt-3" value={best.successPercent} tone={tone} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-6">
          <Button onClick={() => act(best)} icon={best.isNow ? <LuPlay size={16} aria-hidden="true" /> : <LuCalendarPlus size={16} aria-hidden="true" />}>
            {best.isNow ? 'Start now' : `Schedule for ${best.timeLabel}`}
          </Button>
          {soonest && (
            <Button variant="secondary" onClick={() => act(soonest)}>
              {soonest.isNow ? 'Or start now' : `Or ${soonest.timeLabel}`}: {soonest.plannedDuration} min · <span className="df-mono">{soonest.successPercent}%</span>
            </Button>
          )}
          {otherLength && !compact && (
            <button type="button" className="df-link text-sm" onClick={() => act(otherLength)}>
              {otherLength.plannedDuration} min at {otherLength.timeLabel} · {otherLength.successPercent}%
            </button>
          )}
        </div>

        <p className="text-xs text-muted mt-5">
          Compared {rec.optionsScored} start times and lengths for the next 24 hours.{' '}
          {source === 'model' ? 'Scored by your AI model' : 'Scored from how your past sessions went'}, based on your last {basedOn} sessions.
          {!compact && <> <Link to="/dashboard/insights" className="df-link">See your patterns</Link></>}
        </p>
      </Card>

      <AnimatePresence>
        {scheduling && (
          <ScheduleModal
            start={new Date(scheduling.startAt)}
            defaultDuration={scheduling.plannedDuration}
            defaultTitle="Focus session"
            onClose={() => setScheduling(null)}
            onSaved={() => {
              setScheduling(null);
              toast.success('Session scheduled', `${scheduling.plannedDuration} min at ${scheduling.timeLabel}. It starts automatically.`);
              window.dispatchEvent(new CustomEvent('DF_ACTIVE_SESSION_CHANGED'));
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default SessionRecommendation;
