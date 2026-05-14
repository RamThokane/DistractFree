import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import AnimatedCounter from '../components/AnimatedCounter';
import PageTransition from '../components/PageTransition';
import { useCoins } from '../context/CoinContext';
import api from '../services/api';
import { formatRelativeTime } from '../utils/helpers';
import { HiOutlineArrowUp, HiOutlineArrowDown, HiOutlineStar, HiOutlineExclamationTriangle } from 'react-icons/hi2';

const CoinsPage = () => {
  const { balance, refreshBalance } = useCoins();
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [historyRes, summaryRes] = await Promise.all([
        api.get('/coins/history'),
        api.get('/coins/summary'),
      ]);

      if (historyRes.data.success) {
        setTransactions(historyRes.data.transactions);
      }
      if (summaryRes.data.success) {
        setSummary(summaryRes.data.summary);
      }

      refreshBalance();
    } catch (err) {
      console.error('[Coins] Fetch error:', err);
      setError('Failed to load coin data.');
    } finally {
      setLoading(false);
    }
  }, [refreshBalance]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTypeIcon = (type) => {
    switch (type) {
      case 'earned': return <HiOutlineArrowUp className="w-4 h-4 text-sage" />;
      case 'spent': return <HiOutlineArrowDown className="w-4 h-4 text-orange-500" />;
      case 'bonus': return <HiOutlineStar className="w-4 h-4 text-amber-500" />;
      case 'penalty': return <HiOutlineExclamationTriangle className="w-4 h-4 text-red-400" />;
      default: return null;
    }
  };

  const getTypeBg = (type) => {
    switch (type) {
      case 'earned': return 'bg-sage-50';
      case 'spent': return 'bg-orange-50';
      case 'bonus': return 'bg-amber-50';
      case 'penalty': return 'bg-red-50';
      default: return 'bg-gray-50';
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

        {/* ── Summary Cards ── */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <GlassCard className="text-center">
              <p className="text-dash-muted text-xs mb-1">Total Earned</p>
              <p className="text-sage font-bold text-xl">+{summary.earned?.total || 0}</p>
              <p className="text-dash-muted text-xs">{summary.earned?.count || 0} transactions</p>
            </GlassCard>
            <GlassCard className="text-center">
              <p className="text-dash-muted text-xs mb-1">Total Spent</p>
              <p className="text-orange-500 font-bold text-xl">-{summary.spent?.total || 0}</p>
              <p className="text-dash-muted text-xs">{summary.spent?.count || 0} unlocks</p>
            </GlassCard>
            <GlassCard className="text-center">
              <p className="text-dash-muted text-xs mb-1">Bonuses</p>
              <p className="text-amber-500 font-bold text-xl">+{summary.bonus?.total || 0}</p>
              <p className="text-dash-muted text-xs">{summary.bonus?.count || 0} bonuses</p>
            </GlassCard>
            <GlassCard className="text-center">
              <p className="text-dash-muted text-xs mb-1">Penalties</p>
              <p className="text-red-400 font-bold text-xl">-{summary.penalty?.total || 0}</p>
              <p className="text-dash-muted text-xs">{summary.penalty?.count || 0} penalties</p>
            </GlassCard>
          </motion.div>
        )}

        {/* ── Transaction History ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <GlassCard>
            <h2 className="text-dash-text font-semibold text-xl mb-5">Transaction History</h2>

            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 px-4 animate-pulse">
                    <div className="w-9 h-9 bg-gray-200 rounded-xl" />
                    <div className="flex-1">
                      <div className="h-4 w-48 bg-gray-200 rounded mb-1" />
                      <div className="h-3 w-20 bg-gray-200 rounded" />
                    </div>
                    <div className="h-4 w-12 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-3">{error}</p>
                <button onClick={fetchData} className="text-indigo-500 font-medium hover:underline">
                  Retry
                </button>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl block mb-3">🪙</span>
                <p className="text-gray-400 text-sm">No transactions yet.</p>
                <p className="text-gray-400 text-xs mt-1">Complete your first focus session to earn coins!</p>
              </div>
            ) : (
              <div className="space-y-1">
                {transactions.map((tx) => (
                  <motion.div
                    key={tx._id}
                    className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-dash-hover transition-colors"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${getTypeBg(tx.type)}`}>
                        {getTypeIcon(tx.type)}
                      </div>
                      <div>
                        <p className="text-dash-text text-sm font-medium">{tx.description || tx.type}</p>
                        <p className="text-dash-muted text-xs">{formatRelativeTime(tx.createdAt)}</p>
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
            )}
          </GlassCard>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default CoinsPage;
