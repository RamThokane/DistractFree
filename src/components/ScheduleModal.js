import React, { useState } from 'react';
import Modal from './Modal';
import { scheduleService } from '../services/endpoints';
import {
  WEEKDAY_SHORT,
  apiErrorMessage,
  browserTimezone,
  fromInputs,
  toDateInput,
  toTimeInput,
} from '../utils/schedule';

const DURATION_CHIPS = [25, 50, 90];
const inputClass =
  'w-full bg-ink/[0.03] border border-ink/[0.1] text-fg rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40';
const labelClass = 'block text-xs font-medium text-fg-2 mb-1.5';

/**
 * Create a scheduled session, or edit one.
 *
 * @param {object}   props
 * @param {Date}     [props.start]       create: suggested start
 * @param {object}   [props.occurrence]  edit: the occurrence from GET /api/schedule
 * @param {Function} props.onClose
 * @param {Function} props.onSaved       called after a successful save
 */
const ScheduleModal = ({ start, occurrence, onClose, onSaved }) => {
  const editing = Boolean(occurrence);
  const initialStart = editing ? new Date(occurrence.startAt) : start;

  const [title, setTitle] = useState(occurrence?.title || '');
  const [subject, setSubject] = useState(occurrence?.subject || '');
  const [date, setDate] = useState(toDateInput(initialStart));
  const [time, setTime] = useState(toTimeInput(initialStart));
  const [duration, setDuration] = useState(String(occurrence?.plannedDuration || 25));
  const [repeat, setRepeat] = useState(occurrence?.repeat || 'none');
  const [repeatDays, setRepeatDays] = useState(occurrence?.repeatDays?.length ? occurrence.repeatDays : [initialStart.getDay()]);
  // Editing one occurrence of a repeating session: just this one, or this and the rest
  const [scope, setScope] = useState('occurrence');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const repeatingOccurrence = editing && occurrence.isRepeating;
  const canChangeRepeat = !repeatingOccurrence || scope === 'following';

  const toggleDay = (day) =>
    setRepeatDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    const startAt = fromInputs(date, time);
    const minutes = Number(duration);
    if (!title.trim()) return setError('Give the session a title.');
    if (Number.isNaN(startAt.getTime())) return setError('Pick a valid date and time.');
    if (startAt <= new Date()) return setError('The start time must be in the future.');
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240) return setError('Duration must be between 5 and 240 minutes.');

    const payload = {
      title: title.trim(),
      subject: subject.trim(),
      startAt: startAt.toISOString(),
      plannedDuration: minutes,
      timezone: browserTimezone(),
    };
    if (canChangeRepeat) {
      payload.repeat = repeat;
      // The first date always counts as one of the repeat days
      payload.repeatDays = repeat === 'weekly' ? [...new Set([...repeatDays, startAt.getDay()])].sort() : [];
    }

    setSaving(true);
    try {
      if (editing) {
        await scheduleService.update(occurrence.id, payload, repeatingOccurrence ? scope : undefined);
      } else {
        await scheduleService.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? 'Edit scheduled session' : 'Schedule a focus session'} onClose={onClose} labelledBy="schedule-modal-title">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {repeatingOccurrence && (
          <fieldset>
            <legend className={labelClass}>Apply changes to</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                ['occurrence', 'Only this session'],
                ['following', 'This and following sessions'],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer ${
                    scope === value ? 'border-indigo-500 bg-indigo-500/10 text-fg' : 'border-ink/[0.1] text-fg-2'
                  }`}
                >
                  <input type="radio" name="scope" value={value} checked={scope === value} onChange={() => setScope(value)} className="text-indigo-500 focus:ring-indigo-500" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div>
          <label htmlFor="schedule-title" className={labelClass}>Title</label>
          <input id="schedule-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Revise chapter 4" required />
        </div>

        <div>
          <label htmlFor="schedule-subject" className={labelClass}>Subject <span className="text-fg-4">(optional)</span></label>
          <input id="schedule-subject" className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={60} placeholder="e.g. Physics" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="schedule-date" className={labelClass}>Date</label>
            <input id="schedule-date" type="date" className={inputClass} value={date} min={toDateInput(new Date())} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="schedule-time" className={labelClass}>Start time</label>
            <input id="schedule-time" type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
        </div>

        <div>
          <label htmlFor="schedule-duration" className={labelClass}>Duration (minutes, 5–240)</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="schedule-duration"
              type="number"
              min={5}
              max={240}
              step={5}
              className={`${inputClass} w-28`}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
            {DURATION_CHIPS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDuration(String(m))}
                aria-pressed={Number(duration) === m}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  Number(duration) === m ? 'bg-indigo-500 text-white border-indigo-500' : 'border-ink/[0.1] text-fg-2 hover:text-fg'
                }`}
              >
                {m} min
              </button>
            ))}
          </div>
        </div>

        {canChangeRepeat ? (
          <div>
            <label htmlFor="schedule-repeat" className={labelClass}>Repeat</label>
            <select id="schedule-repeat" className={inputClass} value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              <option value="none">Does not repeat</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week on…</option>
            </select>
            {repeat === 'weekly' && (
              <fieldset className="mt-2">
                <legend className="sr-only">Repeat on</legend>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_SHORT.map((label, day) => {
                    const isStartDay = fromInputs(date, '12:00').getDay() === day;
                    const on = repeatDays.includes(day) || isStartDay;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => !isStartDay && toggleDay(day)}
                        aria-pressed={on}
                        aria-label={`${label}${isStartDay ? ' (start date)' : ''}`}
                        className={`w-11 py-1.5 rounded-lg text-xs font-medium border focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                          on ? 'bg-indigo-500 text-white border-indigo-500' : 'border-ink/[0.1] text-fg-2 hover:text-fg'
                        } ${isStartDay ? 'cursor-default' : ''}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-fg-4 mt-1.5">The start date's weekday is always included.</p>
              </fieldset>
            )}
          </div>
        ) : (
          <p className="text-xs text-fg-2">Only this session changes; the rest of the series stays as it is.</p>
        )}

        <p className="text-[11px] text-fg-4">
          Times are in your timezone ({browserTimezone()}). The session starts automatically at this time — keep the website or the
          DistractFree extension open.
        </p>

        {error && (
          <p role="alert" className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium text-fg-2 hover:bg-ink/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Schedule session'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ScheduleModal;
