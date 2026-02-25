import React, { useState } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import Button from '../components/Button';
import AnimatedCounter from '../components/AnimatedCounter';
import PageTransition from '../components/PageTransition';
import { useCoins } from '../context/CoinContext';
import { mockTransactions } from '../utils/mockData';
import { formatRelativeTime } from '../utils/helpers';
import { HiOutlineLockOpen, HiOutlineArrowUp, HiOutlineArrowDown, HiOutlineStar } from 'react-icons/hi2';

const UNLOCK_OPTIONS = [
  { coins: 10, minutes: 5, icon: '⏱️' },
  { coins: 25, minutes: 15, icon: '🕐' },
  { coins: 50, minutes: 30, icon: '🔓' },
];

const CoinsPage = () => {
  const { balance, spendCoins } = useCoins();
  const [transactions] = useState(mockTransactions);
  const [unlockingIdx, setUnlockingIdx] = useState(null);

  const handleUnlock = (idx) => {
    const opt = UNLOCK_OPTIONS[idx];
    if (balance < opt.coins) return;
    setUnlockingIdx(idx);
    setTimeout(() => {
      spendCoins(opt.coins);
      setUnlockingIdx(null);
    }, 1000);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'earned': return <HiOutlineArrowUp className="w-4 h-4 text-sage" />;
      case 'spent': return <HiOutlineArrowDown className="w-4 h-4 text-orange-500" />;
      case 'bonus': return <HiOutlineStar className="w-4 h-4 text-amber-500" />;
      default: return null;
    }
  };

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ── Balance Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GlassCard className="text-center py-8">
            <span className="text-5xl mb-3 block">🪙</span>
            <p className="text-dash-muted text-sm mb-1">Your Focus Coin Balance</p>
            <AnimatedCounter
              value={balance}
              className="text-5xl font-bold text-dash-text"
              duration={1}
            />
            <p className="text-dash-muted text-sm mt-2">Earn coins through focus sessions, spend them on controlled breaks</p>
          </GlassCard>
        </motion.div>

        {/* ── Unlock Options ── */}
        <div>
          <h2 className="text-dash-text font-semibold text-xl mb-4 flex items-center gap-2">
            <HiOutlineLockOpen className="w-5 h-5 text-sage" />
            Unlock Options
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {UNLOCK_OPTIONS.map((opt, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <GlassCard
                  hover
                  className={`relative overflow-hidden text-center ${
                    balance < opt.coins ? 'opacity-50' : ''
                  }`}
                >
                  {/* Top accent line */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-sage" />

                  <span className="text-4xl block mb-3">{opt.icon}</span>
                  <h3 className="text-dash-text font-bold text-2xl mb-1">{opt.minutes} min</h3>
                  <p className="text-dash-muted text-sm mb-4">Controlled unlock break</p>

                  <div className="flex items-center justify-center gap-1 mb-4">
                    <span className="text-lg">🪙</span>
                    <span className="text-dash-text font-semibold">{opt.coins} coins</span>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    disabled={balance < opt.coins}
                    loading={unlockingIdx === i}
                    onClick={() => handleUnlock(i)}
                  >
                    {balance < opt.coins ? 'Not enough coins' : 'Unlock'}
                  </Button>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Transaction History ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <GlassCard>
            <h2 className="text-dash-text font-semibold text-xl mb-5">Transaction History</h2>

            <div className="space-y-1">
              {transactions.map((tx) => (
                <motion.div
                  key={tx.id}
                  className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-dash-hover transition-colors"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      tx.type === 'earned' ? 'bg-sage-50' :
                      tx.type === 'spent' ? 'bg-orange-50' : 'bg-amber-50'
                    }`}>
                      {getTypeIcon(tx.type)}
                    </div>
                    <div>
                      <p className="text-dash-text text-sm font-medium">{tx.description}</p>
                      <p className="text-dash-muted text-xs">{formatRelativeTime(tx.date)}</p>
                    </div>
                  </div>
                  <span className={`font-semibold text-sm ${
                    tx.amount > 0 ? 'text-sage' : 'text-orange-500'
                  }`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </span>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default CoinsPage;
