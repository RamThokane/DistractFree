import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '../components/PageTransition';
import Wordmark from '../components/Wordmark';
import { Button, Card, Badge, ProgressRing, Input, useToast } from '../components/ui';
import { useCoins } from '../context/CoinContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatTime, getRandomQuote, motivationalQuotes } from '../utils/helpers';
import { SESSION_PRESETS } from '../utils/coinRules';
import { LuPlay, LuSquare, LuLock, LuCalendarDays, LuRotateCcw, LuX, LuCoins } from 'react-icons/lu';

// Live state (a simple rule over this session's counts, computed on the server)
const LIVE_STATES = {
  low: {
    label: 'Focused',
    message: "You're in the zone. Keep going!",
    tone: 'text-accent',
    dot: 'bg-accent',
  },
  medium: {
    label: 'Drifting',
    message: "You've switched away a few times — bring your attention back to one task.",
    tone: 'text-amber-ink',
    dot: 'bg-amber',
  },
  high: {
    label: 'Distracted',
    message: 'Lots of switching and distracting sites. Close one tab and refocus.',
    tone: 'text-danger',
    dot: 'bg-danger',
  },
};
// Legacy sessions may hold the old labels
const LEGACY_STATUS = { Focused: 'low', Distracted: 'high' };
const EMPTY_COUNTS = { tabSwitches: 0, interruptions: 0, blockAttempts: 0 };
const countsOf = (session) => ({
  tabSwitches: session?.tabSwitches || 0,
  interruptions: session?.interruptions || 0,
  blockAttempts: session?.distractionAttempts || 0,
});
// The extension marks the page when it is installed; it is what counts tab switches
const hasExtension = () => document.documentElement.getAttribute('data-distractfree-extension') === '1';

const initialFromQuery = () => {
  const m = parseInt(new URLSearchParams(window.location.search).get('minutes'), 10);
  if (!m || m < 25 || m > 180) return null;
  const idx = SESSION_PRESETS.findIndex((p) => !p.isCustom && p.seconds === m * 60);
  return idx !== -1 ? { preset: idx, minutes: m } : { preset: SESSION_PRESETS.findIndex((p) => p.isCustom), minutes: m };
};

const FocusSession = () => {
  const { refreshCoins } = useCoins();
  const { user } = useAuth();
  const toast = useToast();
  // A suggested length can arrive as ?minutes=40 (from "Best next session")
  const [suggested] = useState(initialFromQuery);
  const [selectedPreset, setSelectedPreset] = useState(suggested ? suggested.preset : 0);
  const [customMinutes, setCustomMinutes] = useState(suggested ? suggested.minutes : 30);
  const [timeLeft, setTimeLeft] = useState(suggested ? suggested.minutes * 60 : SESSION_PRESETS[0].seconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [quote, setQuote] = useState(() => getRandomQuote(motivationalQuotes));
  const [isInitializing, setIsInitializing] = useState(true);
  const [mlStatus, setMlStatus] = useState('low');
  const [showNudge, setShowNudge] = useState(false);
  const [lastLiveSync, setLastLiveSync] = useState(null);
  const [liveError, setLiveError] = useState(false);
  const [liveCounts, setLiveCounts] = useState(EMPTY_COUNTS);
  const [extensionDetected, setExtensionDetected] = useState(hasExtension);
  const [activeSessionId, setActiveSessionId] = useState(null);
  // Length of the running session when it isn't one of the presets (e.g. a scheduled 40-min session)
  const [activeTotalSecs, setActiveTotalSecs] = useState(null);
  // { title, subject } when the running session came from the calendar
  const [schedule, setSchedule] = useState(null);
  const intervalRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const liveKey = LEGACY_STATUS[mlStatus] || (LIVE_STATES[mlStatus] ? mlStatus : 'low');
  const liveState = LIVE_STATES[liveKey];
  const isDistracted = liveKey === 'high';

  const isCustomPreset = SESSION_PRESETS[selectedPreset]?.isCustom;
  const parsedCustomMinutes = parseInt(customMinutes);
  const effectiveCustomMinutes = isNaN(parsedCustomMinutes) ? 25 : Math.max(25, Math.min(180, parsedCustomMinutes));

  const presetTotal = isCustomPreset ? effectiveCustomMinutes * 60 : SESSION_PRESETS[selectedPreset].seconds;
  const totalTime = activeTotalSecs ?? presetTotal;
  const elapsed = Math.max(0, totalTime - timeLeft);
  const progressPercent = (elapsed / totalTime) * 100;
  const activePreset = activeTotalSecs ? SESSION_PRESETS.find((p) => !p.isCustom && p.seconds === activeTotalSecs) : null;
  const earnableCoins = activePreset
    ? activePreset.coins
    : activeTotalSecs
      ? Math.round((activeTotalSecs / 60) * 0.4)
      : isCustomPreset ? Math.round(effectiveCustomMinutes * 0.4) : SESSION_PRESETS[selectedPreset].coins;

  /** Show a session that is already running on the server (started elsewhere, or by the calendar). */
  const adoptSession = useCallback((session, serverTimeIso, scheduleInfo) => {
    const serverTime = serverTimeIso ? new Date(serverTimeIso).getTime() : Date.now();
    const elapsedSecs = Math.floor((serverTime - new Date(session.startTime).getTime()) / 1000);
    const totalSecs = session.plannedDuration * 60;
    const remaining = totalSecs - elapsedSecs;

    setActiveSessionId(session._id);
    if (session.mlStatus) setMlStatus(session.mlStatus);
    setLiveCounts(countsOf(session));
    const presetIdx = SESSION_PRESETS.findIndex((p) => !p.isCustom && p.seconds === totalSecs);
    if (presetIdx !== -1) setSelectedPreset(presetIdx);
    setActiveTotalSecs(totalSecs);
    setSchedule(scheduleInfo || null);
    if (remaining > 0) {
      setTimeLeft(remaining);
      setIsRunning(true);
      setIsComplete(false);
    } else {
      setTimeLeft(0);
      setIsRunning(false);
      setIsComplete(true);
    }
  }, []);

  /** Back to the idle timer for the selected preset. */
  const resetToIdle = useCallback(() => {
    setIsRunning(false);
    setActiveSessionId(null);
    setActiveTotalSecs(null);
    setSchedule(null);
    setMlStatus('low');
    setLiveCounts(EMPTY_COUNTS);
    setIsComplete(false);
    setTimeLeft(isCustomPreset ? effectiveCustomMinutes * 60 : SESSION_PRESETS[selectedPreset].seconds);
  }, [isCustomPreset, effectiveCustomMinutes, selectedPreset]);

  const isStrictMode = user?.settings?.strictMode || false;

  // ── Start Session (API-backed) ──
  const startTimer = useCallback(async () => {
    try {
      const plannedDuration = Math.round(presetTotal / 60);
      // Timezone lets the server compute hour-of-day features in the user's local time
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await api.post('/session/start', { plannedDuration, timezone });
      if (res.data.success) {
        setActiveSessionId(res.data.session._id);
        setActiveTotalSecs(null);
        setSchedule(null);
        setIsRunning(true);
        setIsComplete(false);
        // Notify extension
        window.dispatchEvent(new CustomEvent('DF_SESSION_START', {
          detail: { duration: plannedDuration, sessionId: res.data.session._id }
        }));
        localStorage.setItem('df_session_action', JSON.stringify({
          action: 'start',
          duration: plannedDuration,
          sessionId: res.data.session._id,
          ts: Date.now()
        }));
      }
    } catch (err) {
      console.error('[FocusSession] Start error:', err);
      // If session already exists, try to resume
      if (err.response?.status === 409 && err.response?.data?.session) {
        adoptSession(err.response.data.session, err.response.data.serverTime, null);
      }
    }
  }, [presetTotal, adoptSession]);

  // ── Stop / Cancel Session (API-backed) ──
  const stopTimer = useCallback(async () => {
    setIsRunning(false);
    if (activeSessionId) {
      try {
        await api.post('/session/end', { sessionId: activeSessionId, cancelled: true });
      } catch (err) {
        console.error('[FocusSession] End error:', err);
      }
    }
    resetToIdle();
    // Notify extension
    window.dispatchEvent(new CustomEvent('DF_SESSION_END'));
    localStorage.setItem('df_session_action', JSON.stringify({ action: 'end', ts: Date.now() }));
  }, [activeSessionId, resetToIdle]);

  // ── Complete Session (timer hits 0) ──
  const completeSession = useCallback(async () => {
    setIsRunning(false);
    setIsComplete(true);
    if (activeSessionId) {
      try {
        const res = await api.post('/session/end', { sessionId: activeSessionId, cancelled: false });
        if (res.data.success) {
          const coins = res.data.session?.coinsEarned || 0;
          if (coins > 0) {
            refreshCoins();
          }
          toast.reward('Focus session complete. Great job!', coins > 0 ? `+${coins} Focus Coins added to your wallet.` : undefined);
        }
      } catch (err) {
        console.error('[FocusSession] Complete error:', err);
      }
    }
    // Notify extension
    window.dispatchEvent(new CustomEvent('DF_SESSION_END'));
    localStorage.setItem('df_session_action', JSON.stringify({ action: 'end', ts: Date.now() }));
  }, [activeSessionId, refreshCoins, toast]);

  const selectPreset = (idx) => {
    if (isRunning) return;
    setSelectedPreset(idx);
    if (SESSION_PRESETS[idx].isCustom) {
      const num = parseInt(customMinutes);
      const effective = isNaN(num) ? 25 : Math.max(25, Math.min(180, num));
      setTimeLeft(effective * 60);
    } else {
      setTimeLeft(SESSION_PRESETS[idx].seconds);
    }
    setIsComplete(false);
  };

  // ── Sync the active session (this request also starts a due scheduled session) ──
  const syncActiveSession = useCallback(async () => {
    try {
      const res = await api.get('/session/active');
      if (res.data.success && res.data.session) {
        adoptSession(res.data.session, res.data.serverTime, res.data.schedule);
      }
    } catch (e) {
      console.error('Failed to sync active session', e);
    } finally {
      setIsInitializing(false);
    }
  }, [adoptSession]);

  useEffect(() => {
    syncActiveSession();
  }, [syncActiveSession]);

  // ── While idle, pick up a session started by the calendar or elsewhere ──
  useEffect(() => {
    if (isRunning || isComplete) return undefined;
    const id = setInterval(syncActiveSession, 30000);
    window.addEventListener('DF_ACTIVE_SESSION_CHANGED', syncActiveSession);
    return () => {
      clearInterval(id);
      window.removeEventListener('DF_ACTIVE_SESSION_CHANGED', syncActiveSession);
    };
  }, [isRunning, isComplete, syncActiveSession]);

  // ── Live state: poll the server every 5 seconds while running ──
  // The extension reports tab switches / blocked attempts; the server turns
  // them into the status. This keeps the card within seconds of it.
  useEffect(() => {
    if (!isRunning || !activeSessionId) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await api.get('/session/active');
        if (!res.data.success) return;
        if (!res.data.session || res.data.session._id !== activeSessionId) {
          // Ended elsewhere (e.g. cancelled from the extension) — reset locally
          resetToIdle();
          return;
        }
        if (res.data.session.mlStatus) {
          setMlStatus(res.data.session.mlStatus);
        }
        setLiveCounts(countsOf(res.data.session));
        setLastLiveSync(new Date());
        setLiveError(false);
        setExtensionDetected(hasExtension());
      } catch (e) {
        setLiveError(true);
      }
    }, 5000);

    return () => clearInterval(pollIntervalRef.current);
  }, [isRunning, activeSessionId, resetToIdle]);

  // ── Live update every 60 seconds while running ──
  // Sends no counts (the extension reports those), so it never overwrites them;
  // returns the live status.
  useEffect(() => {
    if (!isRunning || !activeSessionId) return;

    const sync = async () => {
      try {
        const res = await api.post('/session/live-update', { sessionId: activeSessionId });
        if (!res.data.success) return;
        setLiveError(false);
        setLastLiveSync(new Date());
        if (res.data.liveStatus) setMlStatus(res.data.liveStatus);
        if (res.data.counts) setLiveCounts(res.data.counts);
      } catch (e) {
        setLiveError(true);
      }
    };

    sync();
    const id = setInterval(sync, 60000);
    return () => clearInterval(id);
  }, [isRunning, activeSessionId]);

  // ── Gentle nudge when the live status turns to "Distracted" ──
  const prevStatusRef = useRef(mlStatus);
  useEffect(() => {
    if (isDistracted && prevStatusRef.current !== mlStatus && isRunning) setShowNudge(true);
    if (!isDistracted) setShowNudge(false);
    prevStatusRef.current = mlStatus;
  }, [mlStatus, isDistracted, isRunning]);

  // ── Countdown timer ──
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, timeLeft]);

  // ── Auto-complete when timer hits 0 ──
  useEffect(() => {
    if (timeLeft <= 0 && isRunning) {
      completeSession();
    }
  }, [timeLeft, isRunning, completeSession]);

  // ── Rotate quotes ──
  useEffect(() => {
    const q = setInterval(() => setQuote(getRandomQuote(motivationalQuotes)), 60000);
    return () => clearInterval(q);
  }, []);

  const status = isComplete ? 'Session complete' : isRunning ? 'Stay with it' : 'Ready when you are';

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto">
        {isInitializing ? (
          <div className="flex flex-col items-center py-16" aria-busy="true">
            <div className="df-skel" style={{ width: 280, height: 280, borderRadius: '50%' }} />
            <p className="text-sm text-muted mt-6">Syncing session state…</p>
          </div>
        ) : (
          <>
            {/* ── Timer ── */}
            <section className="flex flex-col items-center text-center pt-2 pb-10" aria-label="Focus timer">
              <div className="flex flex-wrap justify-center gap-2 mb-6 min-h-[28px]">
                {isStrictMode && isRunning && (
                  <Badge><LuLock size={12} aria-hidden="true" />Strict mode on</Badge>
                )}
                {schedule && (isRunning || isComplete) && (
                  <Badge tone="accent" className="max-w-full">
                    <LuCalendarDays size={12} aria-hidden="true" />
                    <span className="truncate">{schedule.title}{schedule.subject ? ` · ${schedule.subject}` : ''}</span>
                  </Badge>
                )}
              </div>

              {/* Session presets */}
              <div className="df-tabs df-tabs--pill mb-8" role="radiogroup" aria-label="Session length">
                {SESSION_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={i === selectedPreset}
                    aria-selected={i === selectedPreset}
                    disabled={isRunning}
                    className="df-tab disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => selectPreset(i)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom Time Input */}
              <AnimatePresence>
                {isCustomPreset && !isRunning && !isComplete && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-6 w-44 text-left"
                  >
                    <Input
                      label="Minutes (25–180)"
                      type="number"
                      min="25"
                      max="180"
                      className="text-center df-mono"
                      value={customMinutes}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val !== '' && parseInt(val) > 180) val = '180';
                        setCustomMinutes(val);
                        const num = parseInt(val);
                        if (!isNaN(num) && num >= 25 && num <= 180) setTimeLeft(num * 60);
                      }}
                      onBlur={(e) => {
                        let val = parseInt(e.target.value);
                        if (isNaN(val) || val < 25) val = 25;
                        if (val > 180) val = 180;
                        setCustomMinutes(val);
                        setTimeLeft(val * 60);
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Timer ring */}
              <ProgressRing
                value={elapsed}
                max={totalTime}
                size={300}
                stroke={4}
                labelSize={60}
                label={isComplete ? 'Done' : formatTime(timeLeft)}
                sublabel={status}
                title="Session progress"
                className="max-w-full"
              />

              {/* Controls */}
              <div className="flex items-center gap-3 mt-10">
                {!isRunning && !isComplete && (
                  <Button size="lg" onClick={startTimer} icon={<LuPlay size={18} aria-hidden="true" />}>
                    Start focus
                  </Button>
                )}
                {isRunning && (
                  <Button variant="danger-outline" onClick={stopTimer} icon={<LuSquare size={14} aria-hidden="true" />}>
                    End session early
                  </Button>
                )}
                {isComplete && (
                  <Button variant="secondary" size="lg" onClick={resetToIdle} icon={<LuRotateCcw size={16} aria-hidden="true" />}>
                    Start another
                  </Button>
                )}
              </div>

              {/* Coins to earn */}
              <p className="mt-5 inline-flex items-center gap-2 text-sm text-muted">
                <LuCoins className="text-amber" aria-hidden="true" />
                Finish to earn up to <span className="df-mono font-semibold text-amber-ink">{earnableCoins}</span> Focus Coins
              </p>
            </section>

            {/* ── Gentle nudge when the live status turns to Distracted ── */}
            <AnimatePresence>
              {showNudge && isRunning && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-start justify-between gap-4 rounded-lg bg-amber-soft px-5 py-4 mb-8"
                  role="status"
                >
                  <p className="text-sm text-text leading-relaxed">
                    <span className="font-semibold">Quick check-in:</span> lots of switching away in the last few minutes.
                    Close one distracting tab and give the next five minutes to a single task.
                  </p>
                  <button onClick={() => setShowNudge(false)} className="app-icon-btn -mt-1 -mr-2 flex-shrink-0" aria-label="Dismiss">
                    <LuX />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Live state — only while a session is running ── */}
            {isRunning && (
              <Card variant="plain" className="mb-8" aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <p className="df-label">Live state</p>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <span className={`w-2 h-2 rounded-full ${liveError ? 'bg-amber' : 'bg-accent'}`} aria-hidden="true" />
                    {liveError ? 'Reconnecting…' : 'Live'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${liveState.dot}`} aria-hidden="true" />
                  <h3 className={`df-display text-t-40 ${liveState.tone}`}>{liveState.label}</h3>
                </div>
                <p className="text-sm text-text-2 mt-2 max-w-prose">{liveState.message}</p>

                <dl className="pg-stats pg-stats--3 mt-6">
                  {[
                    ['Tab switches', liveCounts.tabSwitches],
                    ['Distracting sites', liveCounts.interruptions],
                    ['Blocked attempts', liveCounts.blockAttempts],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="df-label">{label}</dt>
                      <dd className="df-mono text-t-28 text-text mt-1">{value}</dd>
                    </div>
                  ))}
                </dl>

                {!extensionDetected && (
                  <p className="text-xs text-amber-ink mt-4">
                    The <Wordmark /> extension wasn't detected in this browser. It's what counts tab switches and blocked
                    sites, so without it the live state stays at Focused.
                  </p>
                )}
                <p className="text-xs text-muted mt-2 df-mono">
                  {liveError
                    ? 'Live update failed, retrying'
                    : lastLiveSync ? `Updated ${lastLiveSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Waiting for the first update…'}
                </p>
              </Card>
            )}

            {/* ── Quote ── */}
            <figure className="border-l-2 border-accent pl-5 py-1 max-w-xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.blockquote
                  key={quote}
                  className="df-display text-t-28 leading-snug text-text"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  “{quote}”
                </motion.blockquote>
              </AnimatePresence>
              <figcaption className="text-xs text-muted mt-2">A new line every minute</figcaption>
            </figure>
          </>
        )}
      </div>
    </PageTransition>
  );
};

export default FocusSession;
