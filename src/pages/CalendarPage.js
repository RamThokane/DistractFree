import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import {
  addDays,
  addMinutes,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { HiOutlinePlus, HiOutlineArrowPath } from 'react-icons/hi2';
import PageTransition from '../components/PageTransition';
import GlassCard from '../components/GlassCard';
import Modal from '../components/Modal';
import ScheduleModal from '../components/ScheduleModal';
import { scheduleService } from '../services/endpoints';
import {
  STATUS_STYLES,
  announceSessionStarted,
  apiErrorMessage,
  formatTime,
  formatWhen,
  repeatLabel,
} from '../utils/schedule';

const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { 'en-US': enUS } });
const LEGEND = ['scheduled', 'active', 'completed', 'cancelled', 'missed'];
const REFRESH_MS = 60 * 1000;

/** The date range a calendar view shows. */
function rangeFor(view, date) {
  if (view === Views.MONTH) return { from: startOfWeek(startOfMonth(date)), to: addDays(endOfWeek(endOfMonth(date)), 1) };
  if (view === Views.WEEK) return { from: startOfWeek(date), to: addDays(startOfWeek(date), 7) };
  return { from: startOfDay(date), to: addDays(startOfDay(date), 1) };
}

/** A sensible start for a new session when a day (not a time) was clicked. */
function suggestedStart(slotStart, view) {
  const now = new Date();
  if (view !== Views.MONTH && slotStart > now) return slotStart;
  const day = startOfDay(slotStart);
  const nineAm = new Date(day.getTime() + 9 * 60 * 60 * 1000);
  if (nineAm > now) return nineAm;
  // Today (or a past day): the next full hour from now
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  return new Date(next.getTime() + 60 * 60 * 1000);
}

const StatusBadge = ({ status }) => {
  const style = STATUS_STYLES[status] || STATUS_STYLES.scheduled;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: `${style.color}1f`, color: style.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.color }} aria-hidden="true" />
      {style.label}
    </span>
  );
};

const CalendarPage = () => {
  const navigate = useNavigate();
  const [view, setView] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? Views.DAY : Views.WEEK));
  const [date, setDate] = useState(() => new Date());
  const [data, setData] = useState({ occurrences: [], focusSessions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // { type: 'create', start } | { type: 'edit', occurrence } | { type: 'detail', event }
  const [dialog, setDialog] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => rangeFor(view, date), [view, date]);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const res = await scheduleService.list(range.from.toISOString(), range.to.toISOString());
      setData({ occurrences: res.data.occurrences || [], focusSessions: res.data.focusSessions || [] });
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't load your calendar."));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);
  // Statuses change on their own (started, missed), so refresh quietly
  useEffect(() => {
    const id = setInterval(() => load({ quiet: true }), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const events = useMemo(() => {
    const sessionIds = new Set(data.focusSessions.map((s) => s.id));
    const scheduled = data.occurrences
      // A started occurrence is shown as the focus session it became
      .filter((o) => !(o.status === 'started' && o.focusSessionId && sessionIds.has(o.focusSessionId)))
      .map((o) => ({
        id: `o-${o.id}`,
        title: o.title,
        start: new Date(o.startAt),
        end: new Date(o.endAt),
        kind: 'occurrence',
        status: o.status,
        occurrence: o,
      }));
    const ran = data.focusSessions.map((s) => {
      const start = new Date(s.startTime);
      const actualEnd = s.endTime ? new Date(s.endTime) : addMinutes(start, s.plannedDuration);
      return {
        id: `f-${s.id}`,
        title: s.title || 'Focus session',
        start,
        // Very short sessions still get a visible block
        end: actualEnd - start < 5 * 60 * 1000 ? addMinutes(start, 5) : actualEnd,
        kind: 'session',
        status: s.status,
        session: s,
      };
    });
    return [...scheduled, ...ran];
  }, [data]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return data.occurrences
      .filter((o) => o.status === 'scheduled' && new Date(o.endAt) > now)
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
      .slice(0, 6);
  }, [data]);

  const eventPropGetter = useCallback((event) => {
    const color = (STATUS_STYLES[event.status] || STATUS_STYLES.scheduled).color;
    return {
      style: { backgroundColor: color, borderColor: color, color: '#fff', opacity: event.status === 'missed' ? 0.85 : 1 },
      'aria-label': `${event.title}, ${(STATUS_STYLES[event.status] || {}).label || event.status}, ${formatWhen(event.start)}`,
    };
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setActionError(null);
  }, []);

  const afterChange = useCallback(() => {
    closeDialog();
    load({ quiet: true });
  }, [closeDialog, load]);

  const startNow = async (occurrence) => {
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

  const cancel = async (occurrence, scope) => {
    const question = scope === 'following'
      ? `Cancel "${occurrence.title}" on ${formatWhen(occurrence.startAt)} and every later session in this series?`
      : `Cancel "${occurrence.title}" on ${formatWhen(occurrence.startAt)}?`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setActionError(null);
    try {
      await scheduleService.cancel(occurrence.id, scope);
      afterChange();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openCreate = (start) => setDialog({ type: 'create', start });
  const openDetail = (event) => { setActionError(null); setDialog({ type: 'detail', event }); };

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-[1.75rem] font-semibold text-fg tracking-tight">Focus Calendar</h1>
            <p className="text-sm text-fg-2 mt-1">Plan focus sessions ahead — they start automatically at their time.</p>
          </div>
          <button
            type="button"
            onClick={() => openCreate(suggestedStart(new Date(), Views.MONTH))}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            <HiOutlinePlus className="w-4 h-4" aria-hidden="true" /> New session
          </button>
        </div>

        {/* ── Legend ── */}
        <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Colour legend">
          {LEGEND.map((status) => (
            <li key={status} className="flex items-center gap-1.5 text-xs text-fg-2">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: STATUS_STYLES[status].color }} aria-hidden="true" />
              {STATUS_STYLES[status].label}
            </li>
          ))}
        </ul>

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-3">
            <p className="text-sm text-red-600">{error}</p>
            <button type="button" onClick={() => load()} className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded">
              <HiOutlineArrowPath className="w-4 h-4" aria-hidden="true" /> Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
          {/* ── Calendar ── */}
          <GlassCard padding="p-3 sm:p-5" className="relative">
            <div className="df-calendar" aria-busy={loading}>
              {!loading && !error && events.length === 0 && (
                <p className="text-sm text-fg-2 mb-3">
                  Nothing in this {view}. Click an empty slot or <span className="font-medium text-fg">New session</span> to plan one.
                </p>
              )}
              <div style={{ height: 'max(560px, calc(100vh - 300px))' }}>
                <Calendar
                  localizer={localizer}
                  culture="en-US"
                  events={events}
                  view={view}
                  date={date}
                  onView={setView}
                  onNavigate={setDate}
                  views={[Views.MONTH, Views.WEEK, Views.DAY]}
                  selectable
                  popup
                  scrollToTime={new Date(1970, 0, 1, 8)}
                  onSelectSlot={(slot) => openCreate(suggestedStart(slot.start, view))}
                  onSelectEvent={openDetail}
                  onKeyPressEvent={(event, e) => { if (e.key === 'Enter' || e.key === ' ') openDetail(event); }}
                  eventPropGetter={eventPropGetter}
                  tooltipAccessor={(e) => `${e.title} · ${(STATUS_STYLES[e.status] || {}).label || e.status}`}
                />
              </div>
            </div>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-canvas/40 backdrop-blur-[1px]" role="status">
                <span className="text-sm text-fg-2">Loading calendar…</span>
              </div>
            )}
          </GlassCard>

          {/* ── Upcoming (keyboard-friendly list) ── */}
          <GlassCard padding="p-5">
            <h2 className="text-sm font-semibold text-fg mb-3">Upcoming in this view</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-fg-2">No upcoming sessions here.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => openDetail({ kind: 'occurrence', status: o.status, occurrence: o, title: o.title })}
                      className="w-full text-left rounded-xl border border-ink/[0.06] px-3 py-2.5 hover:bg-ink/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <p className="text-sm font-medium text-fg truncate">{o.title}</p>
                      <p className="text-xs text-fg-2">
                        {formatWhen(o.startAt)} · {o.plannedDuration} min{o.isRepeating ? ' · repeats' : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
      </div>

      <AnimatePresence>
        {dialog?.type === 'create' && (
          <ScheduleModal key="create" start={dialog.start} onClose={closeDialog} onSaved={afterChange} />
        )}
        {dialog?.type === 'edit' && (
          <ScheduleModal key="edit" occurrence={dialog.occurrence} onClose={closeDialog} onSaved={afterChange} />
        )}
        {dialog?.type === 'detail' && (
          <EventDetail
            key="detail"
            event={dialog.event}
            busy={busy}
            error={actionError}
            onClose={closeDialog}
            onEdit={(occurrence) => setDialog({ type: 'edit', occurrence })}
            onStartNow={startNow}
            onCancel={cancel}
            onOpenFocus={() => navigate('/dashboard/focus')}
          />
        )}
      </AnimatePresence>
    </PageTransition>
  );
};

const actionClass = 'px-4 py-2.5 rounded-xl text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50';

/** Details and actions for a calendar event. */
const EventDetail = ({ event, busy, error, onClose, onEdit, onStartNow, onCancel, onOpenFocus }) => {
  if (event.kind === 'session') {
    const s = event.session;
    return (
      <Modal title={event.title} onClose={onClose} labelledBy="event-detail-title">
        <div className="space-y-3">
          <StatusBadge status={s.status} />
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-fg-2">Started</dt><dd className="text-fg text-right">{formatWhen(s.startTime)}</dd>
            {s.endTime && (<><dt className="text-fg-2">Ended</dt><dd className="text-fg text-right">{formatTime(s.endTime)}</dd></>)}
            <dt className="text-fg-2">Focused</dt><dd className="text-fg text-right">{s.status === 'active' ? 'In progress' : `${s.duration} of ${s.plannedDuration} min`}</dd>
            {s.status === 'completed' && (<><dt className="text-fg-2">Coins</dt><dd className="text-fg text-right">🪙 {s.coinsEarned}</dd></>)}
            {s.subject && (<><dt className="text-fg-2">Subject</dt><dd className="text-fg text-right">{s.subject}</dd></>)}
            <dt className="text-fg-2">Planned</dt><dd className="text-fg text-right">{s.scheduledSessionId ? 'From your calendar' : 'Started by hand'}</dd>
          </dl>
          {s.status === 'active' && (
            <div className="flex justify-end pt-2">
              <button type="button" onClick={onOpenFocus} className={`${actionClass} bg-indigo-500 text-white hover:bg-indigo-600`}>Go to focus session</button>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  const o = event.occurrence;
  const actionable = ['scheduled', 'missed'].includes(o.status);
  return (
    <Modal title={o.title} onClose={onClose} labelledBy="event-detail-title">
      <div className="space-y-4">
        <StatusBadge status={o.status} />
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-fg-2">When</dt><dd className="text-fg text-right">{formatWhen(o.startAt)} – {formatTime(o.endAt)}</dd>
          <dt className="text-fg-2">Duration</dt><dd className="text-fg text-right">{o.plannedDuration} min</dd>
          {o.subject && (<><dt className="text-fg-2">Subject</dt><dd className="text-fg text-right">{o.subject}</dd></>)}
          {o.isRepeating && (<><dt className="text-fg-2">Repeats</dt><dd className="text-fg text-right">{repeatLabel(o)}</dd></>)}
        </dl>
        {o.status === 'missed' && <p className="text-xs text-fg-2">This session didn't start at its time. You can still start it now.</p>}

        {error && <p role="alert" className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

        {actionable && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2 pt-1">
            <button type="button" disabled={busy} onClick={() => onCancel(o, 'occurrence')} className={`${actionClass} text-red-500 hover:bg-red-50`}>
              {o.isRepeating ? 'Cancel this session' : 'Cancel session'}
            </button>
            {o.isRepeating && (
              <button type="button" disabled={busy} onClick={() => onCancel(o, 'following')} className={`${actionClass} text-red-500 hover:bg-red-50`}>
                Cancel this and following
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => onEdit(o)} className={`${actionClass} border border-ink/[0.1] text-fg hover:bg-ink/[0.05]`}>
              Edit
            </button>
            <button type="button" disabled={busy} onClick={() => onStartNow(o)} className={`${actionClass} bg-indigo-500 text-white hover:bg-indigo-600 font-semibold`}>
              {busy ? 'Working…' : 'Start now'}
            </button>
          </div>
        )}
        {o.status === 'started' && (
          <div className="flex justify-end">
            <button type="button" onClick={onOpenFocus} className={`${actionClass} bg-indigo-500 text-white hover:bg-indigo-600`}>Go to focus session</button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CalendarPage;
