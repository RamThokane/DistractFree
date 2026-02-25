import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useCoins } from '../context/CoinContext';

const RewardPopup = () => {
  const { pendingReward, clearReward } = useCoins();

  return (
    <AnimatePresence>
      {pendingReward && (
        <>
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={150}
            gravity={0.3}
            colors={['#6366F1', '#34D399', '#818CF8', '#6EE7B7', '#A78BFA']}
          />
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={clearReward}
          >
            <motion.div
              className="bg-white/15 backdrop-blur-2xl border border-white/25 rounded-[32px] p-10 text-center max-w-sm mx-4 shadow-2xl"
              initial={{ scale: 0.5, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -30 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                className="text-6xl mb-4"
                animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                🎉
              </motion.div>
              <motion.h2
                className="text-3xl font-bold text-white mb-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                +{pendingReward.amount} Focus Coins
              </motion.h2>
              <motion.p
                className="text-gray-300 text-sm mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {pendingReward.description}
              </motion.p>
              <motion.div
                className="flex justify-center gap-2 mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {[...Array(5)].map((_, i) => (
                  <motion.span
                    key={i}
                    className="text-2xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                  >
                    🪙
                  </motion.span>
                ))}
              </motion.div>
              <motion.button
                className="mt-4 bg-primary hover:bg-primary-light text-white font-semibold py-2.5 px-8 rounded-full transition-all duration-300"
                onClick={clearReward}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Awesome!
              </motion.button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default RewardPopup;
