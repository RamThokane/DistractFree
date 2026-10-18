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
import { LuPlus, LuRefreshCw } from 'react-icons/lu';
import PageTransition from '../components/PageTransition';
import { Badge, Card } from '../components/ui';
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
  return <Badge tone={style.tone} dot>{style.label}</Badge>;
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
    const st = STATUS_STYLES[event.status] || STATUS_STYLES.scheduled;
    return {
      style: { backgroundColor: st.bg, borderColor: st.bg, color: st.fg, textDecoration: event.status === 'cancelled' ? 'line-through' : 'none' },
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
        <div className="pg-head !mb-0">
          <div>
            <p className="pg-kicker">Calendar</p>
            <h2 className="pg-title">Plan your <em>focus</em></h2>
            <p className="pg-sub">Plan focus sessions ahead — they start automatically at their time.</p>
          </div>
          <button
            type="button"
            onClick={() => openCreate(suggestedStart(new Date(), Views.MONTH))}
            className="df-btn df-btn--primary"
          >
            <LuPlus className="w-4 h-4" aria-hidden="true" /> New session
          </button>
        </div>

        {/* ── Legend ── */}
        <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Colour legend">
          {LEGEND.map((status) => (
            <li key={status} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="w-3 h-3 rounded-sm border border-line" style={{ backgroundColor: STATUS_STYLES[status].bg }} aria-hidden="true" />
              {STATUS_STYLES[status].label}
            </li>
          ))}
        </ul>

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-soft px-5 py-3">
            <p className="text-sm text-danger">{error}</p>
            <button type="button" onClick={() => load()} className="df-btn df-btn--secondary df-btn--sm">
              <LuRefreshCw className="w-4 h-4" aria-hidden="true" /> Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
          {/* ── Calendar ── */}
          <Card padding="p-3 sm:p-5" className="relative">
            <div className="df-calendar" aria-busy={loading}>
              {!loading && !error && events.length === 0 && (
                <p className="text-sm text-muted mb-3">
                  Nothing in this {view}. Click an empty slot or <span className="font-medium text-text">New session</span> to plan one.
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
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-paper/60" role="status">
                <span className="text-sm text-muted">Loading calendar…</span>
              </div>
            )}
          </Card>

          {/* ── Upcoming (keyboard-friendly list) ── */}
          <section aria-labelledby="upcoming-title">
            <div className="pg-section-head">
              <h2 id="upcoming-title" className="pg-h3">Upcoming in this view</h2>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted">No upcoming sessions here.</p>
            ) : (
              <ul>
                {upcoming.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => openDetail({ kind: 'occurrence', status: o.status, occurrence: o, title: o.title })}
                      className="w-full text-left py-3 border-b border-line hover:bg-paper-2 px-2 -mx-2 rounded-md transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
                    >
                      <p className="text-sm font-medium text-text truncate">{o.title}</p>
                      <p className="text-xs text-muted df-mono mt-0.5">
                        {formatWhen(o.startAt)} · {o.plannedDuration} min{o.isRepeating ? ' · repeats' : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
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

const actionClass = 'df-btn';

/** Details and actions for a calendar event. */
const EventDetail = ({ event, busy, error, onClose, onEdit, onStartNow, onCancel, onOpenFocus }) => {
  if (event.kind === 'session') {
    const s = event.session;
    return (
      <Modal title={event.title} onClose={onClose} labelledBy="event-detail-title">
        <div className="space-y-3">
          <StatusBadge status={s.status} />
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted">Started</dt><dd className="text-text text-right">{formatWhen(s.startTime)}</dd>
            {s.endTime && (<><dt className="text-muted">Ended</dt><dd className="text-text text-right">{formatTime(s.endTime)}</dd></>)}
            <dt className="text-muted">Focused</dt><dd className="text-text text-right">{s.status === 'active' ? 'In progress' : `${s.duration} of ${s.plannedDuration} min`}</dd>
            {s.status === 'completed' && (<><dt className="text-muted">Coins</dt><dd className="text-right df-mono text-amber-ink">+{s.coinsEarned}</dd></>)}
            {s.subject && (<><dt className="text-muted">Subject</dt><dd className="text-text text-right">{s.subject}</dd></>)}
            <dt className="text-muted">Planned</dt><dd className="text-text text-right">{s.scheduledSessionId ? 'From your calendar' : 'Started by hand'}</dd>
          </dl>
          {s.status === 'active' && (
            <div className="flex justify-end pt-2">
              <button type="button" onClick={onOpenFocus} className={`${actionClass} df-btn--primary`}>Go to focus session</button>
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
          <dt className="text-muted">When</dt><dd className="text-text text-right">{formatWhen(o.startAt)} – {formatTime(o.endAt)}</dd>
          <dt className="text-muted">Duration</dt><dd className="text-text text-right">{o.plannedDuration} min</dd>
          {o.subject && (<><dt className="text-muted">Subject</dt><dd className="text-text text-right">{o.subject}</dd></>)}
          {o.isRepeating && (<><dt className="text-muted">Repeats</dt><dd className="text-text text-right">{repeatLabel(o)}</dd></>)}
        </dl>
        {o.status === 'missed' && <p className="text-xs text-muted">This session didn't start at its time. You can still start it now.</p>}

        {error && <p role="alert" className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">{error}</p>}

        {actionable && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2 pt-1">
            <button type="button" disabled={busy} onClick={() => onCancel(o, 'occurrence')} className={`${actionClass} df-btn--danger-outline`}>
              {o.isRepeating ? 'Cancel this session' : 'Cancel session'}
            </button>
            {o.isRepeating && (
              <button type="button" disabled={busy} onClick={() => onCancel(o, 'following')} className={`${actionClass} df-btn--danger-outline`}>
                Cancel this and following
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => onEdit(o)} className={`${actionClass} df-btn--secondary`}>
              Edit
            </button>
            <button type="button" disabled={busy} onClick={() => onStartNow(o)} className={`${actionClass} df-btn--primary`}>
              {busy ? 'Working…' : 'Start now'}
            </button>
          </div>
        )}
        {o.status === 'started' && (
          <div className="flex justify-end">
            <button type="button" onClick={onOpenFocus} className={`${actionClass} df-btn--primary`}>Go to focus session</button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CalendarPage;
