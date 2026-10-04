import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import CircularProgress from '../components/CircularProgress';
import Button from '../components/Button';
import PageTransition from '../components/PageTransition';
import { useCoins } from '../context/CoinContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatTime, getRandomQuote, motivationalQuotes } from '../utils/helpers';
import { SESSION_PRESETS } from '../utils/coinRules';
import { HiOutlinePlay, HiOutlineStop, HiOutlineLockClosed, HiOutlineCalendarDays } from 'react-icons/hi2';

// Live state (a simple rule over this session's counts, computed on the server)
const LIVE_STATES = {
  low: {
    label: 'Focused',
    icon: '🎯',
    message: "You're in the zone. Keep going!",
    badge: 'bg-green-100 text-green-600',
    text: 'text-green-600',
  },
  medium: {
    label: 'Drifting',
    icon: '🌊',
    message: "You've switched away a few times — bring your attention back to one task.",
    badge: 'bg-amber-100 text-amber-600',
    text: 'text-amber-500',
  },
  high: {
    label: 'Distracted',
    icon: '⚠️',
    message: 'Lots of switching and distracting sites. Close one tab and refocus.',
    badge: 'bg-red-100 text-red-600',
    text: 'text-red-600',
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

const FocusSession = () => {
  const { refreshCoins } = useCoins();
  const { user } = useAuth();
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(30);
  const [timeLeft, setTimeLeft] = useState(SESSION_PRESETS[0].seconds);
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
          // Show alert to user
          setTimeout(() => alert('✅ Focus Session Complete! Great job!'), 100);
        }
      } catch (err) {
        console.error('[FocusSession] Complete error:', err);
      }
    }
    // Notify extension
    window.dispatchEvent(new CustomEvent('DF_SESSION_END'));
    localStorage.setItem('df_session_action', JSON.stringify({ action: 'end', ts: Date.now() }));
  }, [activeSessionId, refreshCoins]);

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

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-6">
        {isInitializing && (
          <div className="text-center text-fg-2 py-10">Syncing session state...</div>
        )}
        {!isInitializing && (
          <>
            {/* ── Timer ── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <GlassCard className="py-10 relative overflow-hidden">
                <div className="flex flex-col items-center w-full relative z-20">
                  {/* Background progress bar */}
                  <div
                    className="absolute bottom-[-40px] left-[-24px] right-[-24px] h-1 bg-blue-500 transition-all duration-1000 ease-linear rounded-full opacity-50"
                    style={{ width: `${progressPercent}%` }}
                  />

                  {/* Strict mode indicator */}
                  {isStrictMode && isRunning && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-4 py-1.5 mb-4"
                    >
                      <HiOutlineLockClosed className="w-4 h-4 text-red-500" />
                      <span className="text-red-600 text-xs font-semibold">Strict Mode Active</span>
                    </motion.div>
                  )}

                  {/* Scheduled session title */}
                  {schedule && (isRunning || isComplete) && (
                    <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 mb-4 max-w-full">
                      <HiOutlineCalendarDays className="w-4 h-4 text-indigo-500 flex-shrink-0" aria-hidden="true" />
                      <span className="text-indigo-600 text-sm font-semibold truncate">{schedule.title}</span>
                      {schedule.subject && <span className="text-fg-2 text-sm truncate">· {schedule.subject}</span>}
                    </div>
                  )}

                  {/* Session presets */}
                  <div className="flex flex-wrap justify-center gap-2 mb-8">
                    {SESSION_PRESETS.map((p, i) => (
                      <motion.button
                        key={i}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                          i === selectedPreset
                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                            : 'bg-ink/[0.03] border border-ink/[0.06] text-fg-2 hover:text-hi hover:bg-ink/[0.06]'
                        } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => selectPreset(i)}
                        whileHover={!isRunning ? { scale: 1.05 } : {}}
                        whileTap={!isRunning ? { scale: 0.95 } : {}}
                      >
                        {p.label}
                      </motion.button>
                    ))}
                  </div>

                  {/* Custom Time Input */}
                  <AnimatePresence>
                    {isCustomPreset && !isRunning && !isComplete && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="flex items-center gap-3 overflow-hidden"
                      >
                        <span className="text-sm text-fg-2">Duration (minutes):</span>
                        <input
                          type="number"
                          min="25"
                          max="180"
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
                          className="w-24 text-center bg-ink/[0.03] border border-ink/[0.1] text-hi rounded-lg py-1.5 focus:outline-none focus:border-indigo-500"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Timer ring */}
                  <div className="relative">
                    <CircularProgress
                      value={elapsed}
                      max={totalTime}
                      size={260}
                      strokeWidth={14}
                      color={isComplete ? '#10B981' : '#7E8CF6'}
                      label={isComplete ? '✓' : formatTime(timeLeft)}
                      sublabel={isComplete ? 'Session Complete!' : isRunning ? 'Stay focused...' : 'Ready to focus'}
                    />
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-4 mt-8">
                    {!isRunning && !isComplete && (
                      <Button variant="primary" size="lg" onClick={startTimer} icon={<HiOutlinePlay className="w-5 h-5" />}>
                        Start Focus
                      </Button>
                    )}
                    {isRunning && (
                      <Button variant="danger" size="md" onClick={stopTimer} icon={<HiOutlineStop className="w-5 h-5" />}>
                        Cancel
                      </Button>
                    )}
                    {isComplete && (
                      <Button variant="accent" size="lg" onClick={resetToIdle}>
                        Start Another
                      </Button>
                    )}
                  </div>

                  {/* Coins to earn */}
                  <div className="mt-6 flex items-center justify-center gap-2 bg-ink/[0.03] border border-ink/[0.06] rounded-full px-5 py-2.5">
                    <span className="text-lg">🪙</span>
                    <span className="text-fg-2 text-sm">
                      Earn up to <span className="text-amber-400 font-semibold">{earnableCoins}</span> Focus Coins
                    </span>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* ── Gentle nudge when the live status turns to Distracted ── */}
            <AnimatePresence>
              {showNudge && isRunning && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-amber-300/40 bg-amber-50 dark:bg-amber-500/10 px-5 py-4"
                >
                  <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                    <span className="font-semibold">Quick check-in:</span> lots of switching away in the last few minutes.
                    Close one distracting tab and give the next five minutes to a single task.
                  </p>
                  <button onClick={() => setShowNudge(false)} className="text-amber-700 dark:text-amber-200 text-sm font-medium flex-shrink-0">
                    Dismiss
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Bottom Info Row ── */}
            <div className={`grid grid-cols-1 gap-4 ${isRunning ? 'md:grid-cols-2' : ''}`}>
              {/* Live State — only while a session is running */}
              {isRunning && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <GlassCard>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="text-fg font-semibold">Live State</h3>
                    <span className="flex items-center gap-1.5 text-[11px] text-dash-muted">
                      <span className={`w-2 h-2 rounded-full ${liveError ? 'bg-amber-400' : 'bg-green-500 animate-pulse'}`} aria-hidden="true" />
                      {liveError ? 'Reconnecting…' : 'Live'}
                    </span>
                  </div>

                    <>
                      <div className="flex items-center gap-4" aria-live="polite">
                        <div className={`p-4 rounded-full ${liveState.badge}`}>
                          <span className="text-3xl font-bold" aria-hidden="true">{liveState.icon}</span>
                        </div>
                        <div>
                          <h4 className={`text-xl font-bold ${liveState.text}`}>{liveState.label}</h4>
                          <p className="text-dash-muted text-sm leading-relaxed mt-1">{liveState.message}</p>
                        </div>
                      </div>

                      <dl className="grid grid-cols-3 gap-2 mt-4 text-center">
                        {[
                          ['Tab switches', liveCounts.tabSwitches],
                          ['Distracting sites', liveCounts.interruptions],
                          ['Blocked attempts', liveCounts.blockAttempts],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-xl bg-ink/[0.03] border border-ink/[0.06] py-2">
                            <dd className="text-fg font-bold text-lg tabular-nums">{value}</dd>
                            <dt className="text-dash-muted text-[11px]">{label}</dt>
                          </div>
                        ))}
                      </dl>

                      {!extensionDetected && (
                        <p className="text-[11px] text-amber-600 mt-3">
                          The DistractFree extension wasn't detected in this browser. It's what counts tab switches and blocked
                          sites, so without it the live state stays at Focused.
                        </p>
                      )}
                      <p className="text-dash-muted/70 text-[11px] mt-2">
                        {liveError
                          ? 'Live update failed, retrying'
                          : lastLiveSync ? `Updated ${lastLiveSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Waiting for the first update…'}
                      </p>
                    </>
                </GlassCard>
              </motion.div>
              )}

              {/* Motivational Quote */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <GlassCard className="flex flex-col justify-center h-full">
                  <span className="text-2xl mb-3">💡</span>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={quote}
                      className="text-dash-muted text-sm leading-relaxed italic"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.4 }}
                    >
                      "{quote}"
                    </motion.p>
                  </AnimatePresence>
                  <p className="text-dash-muted/50 text-xs mt-3">Refreshes every minute</p>
                </GlassCard>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
};

export default FocusSession;
