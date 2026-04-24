import React, { useState } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import AnimatedCounter from '../components/AnimatedCounter';
import PageTransition from '../components/PageTransition';
import { useCoins } from '../context/CoinContext';
import { mockTransactions } from '../utils/mockData';
import { formatRelativeTime } from '../utils/helpers';
import { HiOutlineArrowUp, HiOutlineArrowDown, HiOutlineStar } from 'react-icons/hi2';

const CoinsPage = () => {
  const { balance } = useCoins();
  const [transactions] = useState(mockTransactions);

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
