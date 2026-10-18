import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { LuCoins } from 'react-icons/lu';
import { useCoins } from '../context/CoinContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui';

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const RewardPopup = () => {
  const { pendingReward, clearReward } = useCoins();
  const { isDark } = useTheme();

  return (
    <AnimatePresence>
      {pendingReward && (
        <>
          {!reduceMotion() && (
            <Confetti
              width={window.innerWidth}
              height={window.innerHeight}
              recycle={false}
              numberOfPieces={90}
              gravity={0.25}
              colors={isDark ? ['#7FC2A3', '#E0B04A', '#EDE9E1'] : ['#1F5E4A', '#C8901E', '#DCD5C9']}
            />
          )}
          <motion.div
            className="df-modal-backdrop"
            style={{ zIndex: 100 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={clearReward}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="reward-title"
              className="df-modal max-w-sm text-center"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-soft text-amber mb-4">
                <LuCoins size={22} aria-hidden="true" />
              </span>
              <h2 id="reward-title" className="df-display text-t-40">
                <span className="df-mono text-amber-ink">+{pendingReward.amount}</span> Focus Coins
              </h2>
              <p className="text-sm text-muted mt-2 mb-6">{pendingReward.description}</p>
              <Button onClick={clearReward} autoFocus>Nice, keep going</Button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default RewardPopup;
