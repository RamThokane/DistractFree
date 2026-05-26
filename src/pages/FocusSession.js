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
import { HiOutlinePlay, HiOutlineStop, HiOutlineLockClosed } from 'react-icons/hi2';

const SESSION_PRESETS = [
  { label: '25 min (Pomodoro)', seconds: 25 * 60, coins: 10 },
  { label: '50 min (Deep Work)', seconds: 50 * 60, coins: 25 },
  { label: '90 min (Marathon)', seconds: 90 * 60, coins: 40 },
  { label: '120 min (Ultra)', seconds: 120 * 60, coins: 60 },
  { label: 'Custom', isCustom: true },
];

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
  const [mlStatus, setMlStatus] = useState('Focused');
  const [activeSessionId, setActiveSessionId] = useState(null);
  const intervalRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const isCustomPreset = SESSION_PRESETS[selectedPreset]?.isCustom;
  const parsedCustomMinutes = parseInt(customMinutes);
  const effectiveCustomMinutes = isNaN(parsedCustomMinutes) ? 25 : Math.max(25, Math.min(180, parsedCustomMinutes));

  const totalTime = isCustomPreset ? effectiveCustomMinutes * 60 : SESSION_PRESETS[selectedPreset].seconds;
  const elapsed = Math.max(0, totalTime - timeLeft);
  const progressPercent = (elapsed / totalTime) * 100;
  const earnableCoins = isCustomPreset ? Math.round(effectiveCustomMinutes * 0.4) : SESSION_PRESETS[selectedPreset].coins;

  const isStrictMode = user?.settings?.strictMode || false;

  // ── Start Session (API-backed) ──
  const startTimer = useCallback(async () => {
    try {
      const plannedDuration = Math.round(totalTime / 60);
      const res = await api.post('/session/start', { plannedDuration });
      if (res.data.success) {
        setActiveSessionId(res.data.session._id);
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
        const existingSession = err.response.data.session;
        setActiveSessionId(existingSession._id);
        const elapsedSecs = Math.floor((Date.now() - new Date(existingSession.startTime).getTime()) / 1000);
        const totalSecs = existingSession.plannedDuration * 60;
        const remaining = totalSecs - elapsedSecs;
        if (remaining > 0) {
          setTimeLeft(remaining);
          setIsRunning(true);
          setIsComplete(false);
        }
      }
    }
  }, [totalTime]);

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
    setActiveSessionId(null);
    setTimeLeft(isCustomPreset ? effectiveCustomMinutes * 60 : SESSION_PRESETS[selectedPreset].seconds);
    setIsComplete(false);
    // Notify extension
    window.dispatchEvent(new CustomEvent('DF_SESSION_END'));
    localStorage.setItem('df_session_action', JSON.stringify({ action: 'end', ts: Date.now() }));
  }, [activeSessionId, selectedPreset, isCustomPreset, effectiveCustomMinutes]);

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

  // ── Sync active session on mount ──
  useEffect(() => {
    const fetchActiveSession = async () => {
      try {
        const res = await api.get('/session/active');
        if (res.data.success && res.data.session) {
          const session = res.data.session;
          setActiveSessionId(session._id);
          if (session.mlStatus) setMlStatus(session.mlStatus);

          const elapsedSecs = Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000);
          const totalSecs = session.plannedDuration * 60;
          const remaining = totalSecs - elapsedSecs;

          if (remaining > 0) {
            const presetIdx = SESSION_PRESETS.findIndex(p => p.seconds === totalSecs);
            if (presetIdx !== -1) setSelectedPreset(presetIdx);
            setTimeLeft(remaining);
            setIsRunning(true);
            setIsComplete(false);
          } else {
            setTimeLeft(0);
            setIsRunning(false);
            setIsComplete(true);
          }
        }
      } catch (e) {
        console.error('Failed to sync active session', e);
      } finally {
        setIsInitializing(false);
      }
    };
    fetchActiveSession();
  }, []);

  // ── Poll ML status every 5 seconds while running ──
  useEffect(() => {
    if (!isRunning || !activeSessionId) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await api.get('/session/active');
        if (res.data.success && res.data.session?.mlStatus) {
          setMlStatus(res.data.session.mlStatus);
        }
      } catch (e) { /* ignore */ }
    }, 5000);

    return () => clearInterval(pollIntervalRef.current);
  }, [isRunning, activeSessionId]);

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
          <div className="text-center text-gray-500 py-10">Syncing session state...</div>
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

                  {/* Session presets */}
                  <div className="flex flex-wrap justify-center gap-2 mb-8">
                    {SESSION_PRESETS.map((p, i) => (
                      <motion.button
                        key={i}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                          i === selectedPreset
                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                            : 'bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.06]'
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
                        <span className="text-sm text-gray-400">Duration (minutes):</span>
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
                          className="w-24 text-center bg-white/[0.03] border border-white/[0.1] text-white rounded-lg py-1.5 focus:outline-none focus:border-indigo-500"
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
                      <Button variant="accent" size="lg" onClick={() => {
                        setTimeLeft(isCustomPreset ? effectiveCustomMinutes * 60 : SESSION_PRESETS[selectedPreset].seconds);
                        setIsComplete(false);
                        setActiveSessionId(null);
                      }}>
                        Start Another
                      </Button>
                    )}
                  </div>

                  {/* Coins to earn */}
                  <div className="mt-6 flex items-center justify-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-full px-5 py-2.5">
                    <span className="text-lg">🪙</span>
                    <span className="text-gray-400 text-sm">
                      Earn up to <span className="text-amber-400 font-semibold">{earnableCoins}</span> Focus Coins
                    </span>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* ── Bottom Info Row ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <GlassCard>
                  <h3 className="text-gray-900 font-semibold mb-3">Live ML State</h3>
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-full ${mlStatus === 'Distracted' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      <span className="text-3xl font-bold">{mlStatus === 'Distracted' ? '⚠️' : '🎯'}</span>
                    </div>
                    <div>
                      <h4 className={`text-xl font-bold ${mlStatus === 'Distracted' ? 'text-red-600' : 'text-green-600'}`}>
                        {mlStatus}
                      </h4>
                      <p className="text-dash-muted text-sm leading-relaxed mt-1">
                        {mlStatus === 'Distracted'
                          ? 'You seem distracted! Too many tab switches. Focus up!'
                          : 'You are perfectly in the zone. Keep going!'}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>

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
