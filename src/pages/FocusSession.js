import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import CircularProgress from '../components/CircularProgress';
import Button from '../components/Button';
import PageTransition from '../components/PageTransition';
import { useCoins } from '../context/CoinContext';
import { formatTime, getRandomQuote } from '../utils/helpers';
import { motivationalQuotes } from '../utils/mockData';
import { HiOutlinePlay, HiOutlinePause, HiOutlineStop } from 'react-icons/hi2';

const SESSION_PRESETS = [
  { label: '15 min', seconds: 15 * 60, coins: 5 },
  { label: '25 min (Pomodoro)', seconds: 25 * 60, coins: 10 },
  { label: '50 min (Deep Work)', seconds: 50 * 60, coins: 25 },
  { label: '90 min (Marathon)', seconds: 90 * 60, coins: 40 },
  { label: '120 min (Ultra)', seconds: 120 * 60, coins: 60 },
];

const FocusSession = () => {
  const { addCoins } = useCoins();
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SESSION_PRESETS[0].seconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [quote, setQuote] = useState(() => getRandomQuote(motivationalQuotes));
  const [isInitializing, setIsInitializing] = useState(true);
  const [mlStatus, setMlStatus] = useState('Focused');
  const intervalRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const totalTime = SESSION_PRESETS[selectedPreset].seconds;
  const elapsed = totalTime - timeLeft;
  const progressPercent = (elapsed / totalTime) * 100;
  const earnableCoins = SESSION_PRESETS[selectedPreset].coins;

  const startTimer = useCallback(() => {
    setIsRunning(true);
    setIsComplete(false);
    // Notify extension
    window.dispatchEvent(new CustomEvent('DF_SESSION_START', { 
      detail: { duration: Math.round(totalTime / 60) } 
    }));
    localStorage.setItem('df_session_action', JSON.stringify({
      action: 'start',
      duration: Math.round(totalTime / 60),
      ts: Date.now()
    }));
  }, [totalTime]);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
  }, []);

  const stopTimer = useCallback(() => {
    setIsRunning(false);
    if (elapsed >= 60) {
      const ratio = elapsed / totalTime;
      const coinsEarned = Math.round(earnableCoins * ratio);
      addCoins(coinsEarned, `Focus session completed (${Math.round(elapsed / 60)} min)`);
    }
    setTimeLeft(SESSION_PRESETS[selectedPreset].seconds);
    setIsComplete(false);
    // Notify extension
    window.dispatchEvent(new CustomEvent('DF_SESSION_END'));
    localStorage.setItem('df_session_action', JSON.stringify({
      action: 'end',
      ts: Date.now()
    }));
  }, [elapsed, totalTime, earnableCoins, addCoins, selectedPreset]);

  const selectPreset = (idx) => {
    if (isRunning) return;
    setSelectedPreset(idx);
    setTimeLeft(SESSION_PRESETS[idx].seconds);
    setIsComplete(false);
  };

  useEffect(() => {
    const fetchActiveSession = async () => {
      try {
        const token = localStorage.getItem('df_token');
        if (!token) return;
        const res = await fetch('http://localhost:5000/api/session/active', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.session) {
          const session = data.session;
          if (session.mlStatus) {
            setMlStatus(session.mlStatus);
          }
          const elapsedSecs = Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000);
          const totalSecs = session.plannedDuration * 60;
          const remaining = totalSecs - elapsedSecs;

          if (remaining > 0) {
            // Find best matching preset
            const presetIdx = SESSION_PRESETS.findIndex(p => p.seconds === totalSecs);
            if (presetIdx !== -1) setSelectedPreset(presetIdx);
            
            setTimeLeft(remaining);
            setIsRunning(true);
            setIsComplete(false);
          } else {
            // It finished while we were away
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

    // Poll every 5 seconds for ML Status if running
    pollIntervalRef.current = setInterval(() => {
      if (isRunning) fetchActiveSession();
    }, 5000);

    return () => clearInterval(pollIntervalRef.current);
  }, [isRunning]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, timeLeft]);

  useEffect(() => {
    if (timeLeft <= 0 && isRunning) {
      setIsRunning(false);
      setIsComplete(true);
      addCoins(earnableCoins, `Focus session completed (${Math.round(totalTime / 60)} min)`);
      // Notify extension
      window.dispatchEvent(new CustomEvent('DF_SESSION_END'));
      localStorage.setItem('df_session_action', JSON.stringify({
        action: 'end',
        ts: Date.now()
      }));
    }
  }, [timeLeft, isRunning, addCoins, earnableCoins, totalTime]);

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
          <GlassCard className="flex flex-col items-center py-10 relative overflow-hidden">
            {/* Background progress bar */}
            <div
              className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${progressPercent}%` }}
            />

            {/* Session presets */}
            <div className="flex gap-2 mb-8">
              {SESSION_PRESETS.map((p, i) => (
                <motion.button
                  key={i}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    i === selectedPreset
                      ? 'bg-gray-900 text-white'
                      : 'bg-dash-hover border border-dash-border text-dash-muted hover:text-dash-text hover:border-dash-border-light'
                  } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => selectPreset(i)}
                  whileHover={!isRunning ? { scale: 1.05 } : {}}
                  whileTap={!isRunning ? { scale: 0.95 } : {}}
                >
                  {p.label}
                </motion.button>
              ))}
            </div>

            {/* Timer ring */}
            <div className="relative">
              <CircularProgress
                value={elapsed}
                max={totalTime}
                size={260}
                strokeWidth={14}
                color={isComplete ? '#10B981' : '#3B82F6'}
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
                <>
                  <Button variant="ghost" size="md" onClick={pauseTimer} icon={<HiOutlinePause className="w-5 h-5" />}>
                    Pause
                  </Button>
                  <Button variant="danger" size="md" onClick={stopTimer} icon={<HiOutlineStop className="w-5 h-5" />}>
                    End
                  </Button>
                </>
              )}
              {!isRunning && elapsed > 0 && !isComplete && (
                <>
                  <Button variant="primary" size="lg" onClick={startTimer} icon={<HiOutlinePlay className="w-5 h-5" />}>
                    Resume
                  </Button>
                  <Button variant="danger" size="md" onClick={stopTimer} icon={<HiOutlineStop className="w-5 h-5" />}>
                    End
                  </Button>
                </>
              )}
              {isComplete && (
                <Button variant="accent" size="lg" onClick={() => { setTimeLeft(SESSION_PRESETS[selectedPreset].seconds); setIsComplete(false); }}>
                  Start Another
                </Button>
              )}
            </div>

            {/* Coins to earn */}
            <div className="mt-4 flex items-center gap-2">
              <span className="text-lg">🪙</span>
              <span className="text-gray-400 text-sm">
                Earn up to <span className="text-blue-600 font-semibold">{earnableCoins}</span> Focus Coins
              </span>
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
