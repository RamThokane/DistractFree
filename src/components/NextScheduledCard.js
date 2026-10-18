import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LuCalendarDays } from 'react-icons/lu';
import api from '../services/api';
import { scheduleService } from '../services/endpoints';
import { Button, Skeleton } from './ui';
import { announceSessionStarted, apiErrorMessage, formatCountdown, formatWhen, repeatLabel } from '../utils/schedule';

const REFRESH_MS = 60 * 1000;

/** Dashboard band: the next scheduled session, a live countdown, Start now / Skip. */
const NextScheduledCard = () => {
  const navigate = useNavigate();
  const [occurrence, setOccurrence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const triggeredRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await scheduleService.next();
      setOccurrence(res.data.occurrence || null);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't load your next session."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    window.addEventListener('DF_ACTIVE_SESSION_CHANGED', load);
    return () => {
      clearInterval(id);
      window.removeEventListener('DF_ACTIVE_SESSION_CHANGED', load);
    };
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const msLeft = occurrence ? new Date(occurrence.startAt).getTime() - now : null;

  // At its start time, ask the server to start it (once per occurrence)
  useEffect(() => {
    if (!occurrence || msLeft > 0 || triggeredRef.current === occurrence.id) return;
    triggeredRef.current = occurrence.id;
    (async () => {
      try {
        const res = await api.get('/session/active');
        const session = res.data?.session;
        if (session && res.data.autoStarted) {
          announceSessionStarted(session);
          navigate('/dashboard/focus');
          return;
        }
      } catch {
        // fall through to a refresh
      }
      load();
    })();
  }, [occurrence, msLeft, navigate, load]);

  const startNow = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await scheduleService.startNow(occurrence.id);
      announceSessionStarted(res.data.session);
      navigate('/dashboard/focus');
    } catch (err) {
      setActionError(apiErrorMessage(err));
      setBusy(false);
    }
  };

  const skip = async () => {
    if (!window.confirm(`Skip "${occurrence.title}" on ${formatWhen(occurrence.startAt)}?`)) return;
    setBusy(true);
    setActionError(null);
    try {
      await scheduleService.cancel(occurrence.id);
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="next-scheduled-title" className="border-y border-line py-5">
      <div className="flex items-start gap-4">
        <LuCalendarDays className="w-5 h-5 mt-0.5 text-muted flex-shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 id="next-scheduled-title" className="df-label mb-1.5">Next scheduled session</h3>

          {loading ? (
            <div aria-busy="true" aria-label="Loading">
              <Skeleton width={220} height={18} />
              <Skeleton className="mt-2" width={140} height={12} />
            </div>
          ) : error ? (
            <p className="text-sm text-danger">
              {error}{' '}
              <button type="button" onClick={load} className="df-link">Retry</button>
            </p>
          ) : !occurrence ? (
            <p className="text-sm text-muted">
              Nothing scheduled.{' '}
              <Link to="/dashboard/calendar" className="df-link df-link--arrow">Plan a session in the calendar</Link>
            </p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-text truncate">
                    {occurrence.title}
                    {occurrence.subject && <span className="text-muted font-normal text-sm"> · {occurrence.subject}</span>}
                  </p>
                  <p className="text-sm text-muted">
                    {formatWhen(occurrence.startAt)} · {occurrence.plannedDuration} min
                    {occurrence.isRepeating && ` · ${repeatLabel(occurrence)}`}
                  </p>
                </div>
                <p className="df-mono text-t-28 text-text" aria-live="polite" aria-atomic="true">
                  {msLeft > 0 ? formatCountdown(msLeft) : 'Starting…'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <Button size="sm" onClick={startNow} disabled={busy}>Start now</Button>
                <Button size="sm" variant="secondary" onClick={skip} disabled={busy}>Skip</Button>
                <Link to="/dashboard/calendar" className="df-link text-sm ml-2">Open calendar</Link>
              </div>
              {actionError && <p role="alert" className="text-sm text-danger mt-2">{actionError}</p>}
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default NextScheduledCard;
