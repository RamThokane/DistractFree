import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiOutlineCalendarDays } from 'react-icons/hi2';
import api from '../services/api';
import { scheduleService } from '../services/endpoints';
import { announceSessionStarted, apiErrorMessage, formatCountdown, formatWhen, repeatLabel } from '../utils/schedule';

const REFRESH_MS = 60 * 1000;

/** Dashboard card: the next scheduled session, a live countdown, Start now / Skip. */
const NextScheduledCard = ({ delay = 0 }) => {
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
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      aria-labelledby="next-scheduled-title"
      className="df-card-bg rounded-2xl p-6 sm:p-7 border border-ink/[0.06] shadow-card-soft"
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-indigo-50 flex-shrink-0">
          <HiOutlineCalendarDays className="w-5 h-5 text-indigo-500" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 id="next-scheduled-title" className="text-sm text-fg-2 mb-0.5">Next scheduled session</h3>

          {loading ? (
            <div className="space-y-2 animate-pulse" aria-busy="true" aria-label="Loading">
              <div className="h-5 w-48 bg-ink/[0.06] rounded" />
              <div className="h-4 w-32 bg-ink/[0.05] rounded" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-500">
              {error}{' '}
              <button type="button" onClick={load} className="font-medium underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">Retry</button>
            </p>
          ) : !occurrence ? (
            <p className="text-sm text-fg-2">
              Nothing scheduled.{' '}
              <Link to="/dashboard/calendar" className="font-medium text-indigo-500 hover:underline">Plan a session in the calendar →</Link>
            </p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-fg truncate">
                    {occurrence.title}
                    {occurrence.subject && <span className="text-fg-2 font-medium text-sm"> · {occurrence.subject}</span>}
                  </p>
                  <p className="text-sm text-fg-2">
                    {formatWhen(occurrence.startAt)} · {occurrence.plannedDuration} min
                    {occurrence.isRepeating && ` · ${repeatLabel(occurrence)}`}
                  </p>
                </div>
                <p className="text-2xl font-bold text-indigo-500 tabular-nums" aria-live="polite" aria-atomic="true">
                  {msLeft > 0 ? formatCountdown(msLeft) : 'Starting…'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  type="button"
                  onClick={startNow}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                >
                  Start now
                </button>
                <button
                  type="button"
                  onClick={skip}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-ink/[0.1] text-fg-2 hover:text-fg hover:bg-ink/[0.04] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  Skip
                </button>
                <Link to="/dashboard/calendar" className="px-4 py-2 rounded-xl text-sm font-medium text-indigo-500 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  Open calendar
                </Link>
              </div>
              {actionError && <p role="alert" className="text-sm text-red-500 mt-2">{actionError}</p>}
            </>
          )}
        </div>
      </div>
    </motion.section>
  );
};

export default NextScheduledCard;
