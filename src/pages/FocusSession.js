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
  { label: '25 min', seconds: 25 * 60, coins: 20 },
  { label: '40 min', seconds: 40 * 60, coins: 35 },
  { label: '60 min', seconds: 60 * 60, coins: 50 },
  { label: '90 min', seconds: 90 * 60, coins: 80 },
];

const FocusSession = () => {
  const { addCoins } = useCoins();
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SESSION_PRESETS[0].seconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [quote, setQuote] = useState(() => getRandomQuote(motivationalQuotes));
  const intervalRef = useRef(null);

  const totalTime = SESSION_PRESETS[selectedPreset].seconds;
  const elapsed = totalTime - timeLeft;
  const progressPercent = (elapsed / totalTime) * 100;
  const earnableCoins = SESSION_PRESETS[selectedPreset].coins;

  const distractionRisk = Math.min(95, Math.round(15 + (elapsed / totalTime) * 50 + Math.sin(elapsed / 300) * 10));

  const startTimer = useCallback(() => {
    setIsRunning(true);
    setIsComplete(false);
  }, []);

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
  }, [elapsed, totalTime, earnableCoins, addCoins, selectedPreset]);

  const selectPreset = (idx) => {
    if (isRunning) return;
    setSelectedPreset(idx);
    setTimeLeft(SESSION_PRESETS[idx].seconds);
    setIsComplete(false);
  };

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
    }
  }, [timeLeft, isRunning, addCoins, earnableCoins, totalTime]);

  useEffect(() => {
    const q = setInterval(() => setQuote(getRandomQuote(motivationalQuotes)), 60000);
    return () => clearInterval(q);
  }, []);

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ── Timer ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard className="flex flex-col items-center py-10 relative overflow-hidden">
            {/* Background progress bar */}
            <div
              className="absolute bottom-0 left-0 h-1 bg-dash-accent transition-all duration-1000 ease-linear rounded-full"
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
                color={isComplete ? '#3FAE6A' : '#3FAE6A'}
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
              <span className="text-dash-muted text-sm">
                Earn up to <span className="text-sage font-semibold">{earnableCoins}</span> Focus Coins
              </span>
            </div>
          </GlassCard>
        </motion.div>

        {/* ── Bottom Info Row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* AI Distraction Risk */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <GlassCard>
              <h3 className="text-dash-text font-semibold mb-3">AI Distraction Risk</h3>
              <div className="flex items-center gap-4">
                <CircularProgress
                  value={distractionRisk}
                  max={100}
                  size={90}
                  strokeWidth={8}
                  color={distractionRisk > 60 ? '#EF6B6B' : distractionRisk > 35 ? '#F5B638' : '#3FAE6A'}
                  label={`${distractionRisk}%`}
                />
                <div>
                  <p className="text-dash-muted text-sm leading-relaxed">
                    {distractionRisk > 60
                      ? 'High risk — take a short break or stretch.'
                      : distractionRisk > 35
                      ? 'Moderate — stay mindful of your current task.'
                      : 'Low risk — you\'re in the zone! Keep going.'}
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
      </div>
    </PageTransition>
  );
};

export default FocusSession;
