/**
 * Helpers shared by the calendar, the dashboard card and the app shell.
 */

/** The browser's IANA timezone — sent with every schedule so repeats keep the local time. */
export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const pad = (n) => String(n).padStart(2, '0');

/** Local "YYYY-MM-DD" for <input type="date">. */
export const toDateInput = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Local "HH:mm" for <input type="time">. */
export const toTimeInput = (date) => {
  const d = new Date(date);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** A local date + time from form inputs, as a Date. */
export const fromInputs = (dateStr, timeStr) => new Date(`${dateStr}T${timeStr}`);

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "in 2 h 05 min", "in 4 min 12 s", "now". */
export function formatCountdown(ms) {
  if (ms <= 0) return 'now';
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (days > 0) return `in ${days} d ${hours} h`;
  if (hours > 0) return `in ${hours} h ${pad(mins)} min`;
  return `in ${mins} min ${pad(secs)} s`;
}

/** "Mon 6 Oct, 9:00 AM" in the browser's timezone. */
export const formatWhen = (date) =>
  new Date(date).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** "Every Mon, Wed" / "Every day" / "" */
export function repeatLabel(occurrence) {
  if (occurrence.repeat === 'daily') return 'Every day';
  if (occurrence.repeat === 'weekly') return `Every ${(occurrence.repeatDays || []).map((d) => WEEKDAY_SHORT[d]).join(', ')}`;
  return '';
}

/**
 * Tell the extension a session is running (same events the Focus page sends),
 * and tell any open Focus page to re-sync.
 */
export function announceSessionStarted(session) {
  if (!session) return;
  window.dispatchEvent(new CustomEvent('DF_SESSION_START', {
    detail: { duration: session.plannedDuration, sessionId: session._id },
  }));
  try {
    localStorage.setItem('df_session_action', JSON.stringify({
      action: 'start',
      duration: session.plannedDuration,
      sessionId: session._id,
      ts: Date.now(),
    }));
  } catch {
    // storage unavailable — the extension still picks it up within a minute
  }
  window.dispatchEvent(new CustomEvent('DF_ACTIVE_SESSION_CHANGED'));
}

/** The most useful message from an API error. */
export function apiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors.map((e) => e.message).join(' ');
  return data?.message || err?.message || fallback;
}

/** Calendar colours by status. */
export const STATUS_STYLES = {
  scheduled: { label: 'Scheduled', color: '#3B82F6' },
  active: { label: 'In progress', color: '#7C5CFC' },
  started: { label: 'In progress', color: '#7C5CFC' },
  completed: { label: 'Completed', color: '#22C55E' },
  cancelled: { label: 'Cancelled', color: '#EF4444' },
  missed: { label: 'Missed', color: '#9CA3AF' },
};
