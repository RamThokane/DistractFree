import React from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../components/GlassCard';
import PageTransition from '../components/PageTransition';
import { mockLeaderboard } from '../utils/mockData';
import { HiOutlineTrophy } from 'react-icons/hi2';

const rankBg = {
  1: 'bg-amber-50 border-amber-200',
  2: 'bg-gray-50 border-gray-200',
  3: 'bg-orange-50 border-orange-200',
};

const rankText = {
  1: 'text-amber-600',
  2: 'text-gray-500',
  3: 'text-orange-600',
};

const rankEmojis = { 1: '🥇', 2: '🥈', 3: '🥉' };

const LeaderboardPage = () => {
  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-dash-text flex items-center justify-center gap-3">
            <HiOutlineTrophy className="w-8 h-8 text-amber-400" />
            Weekly Leaderboard
          </h1>
          <p className="text-dash-muted mt-2">Top focused minds this week</p>
        </motion.div>

        {/* Top 3 podium */}
        <div className="grid grid-cols-3 gap-3 items-end">
          {[1, 0, 2].map((idx) => {
            const entry = mockLeaderboard[idx];
            if (!entry) return null;
            const isFirst = entry.rank === 1;

            return (
              <motion.div
                key={entry.rank}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: entry.rank * 0.15 }}
                className={isFirst ? 'order-2' : entry.rank === 2 ? 'order-1' : 'order-3'}
              >
                <GlassCard
                  className={`text-center relative overflow-hidden ${isFirst ? 'py-8' : 'py-6'} ${
                    entry.isCurrentUser ? 'border-sage' : ''
                  }`}
                >
                  {/* Top accent line */}
                  <div className={`absolute top-0 left-0 right-0 h-0.5 ${
                    entry.rank === 1 ? 'bg-amber-400' : entry.rank === 2 ? 'bg-gray-400' : 'bg-orange-400'
                  }`} />
                  <span className="text-3xl block mb-2">{rankEmojis[entry.rank]}</span>
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 border ${rankBg[entry.rank]}`}>
                    <span className={`font-bold text-lg ${rankText[entry.rank]}`}>{entry.name.charAt(0)}</span>
                  </div>
                  <p className="text-dash-text font-semibold text-sm">{entry.name}</p>
                  <p className="text-sage font-bold text-lg">{entry.weeklyHours}h</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className="text-xs">🪙</span>
                    <span className="text-dash-muted text-xs">{entry.coins}</span>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>

        {/* Full leaderboard table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <GlassCard padding="p-0">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-dash-border text-dash-muted text-xs uppercase tracking-wider">
              <span className="col-span-1">Rank</span>
              <span className="col-span-5">Name</span>
              <span className="col-span-3 text-right">Weekly Hours</span>
              <span className="col-span-3 text-right">Coins</span>
            </div>

            {/* Table rows */}
            {mockLeaderboard.map((entry, i) => (
              <motion.div
                key={entry.rank}
                className={`grid grid-cols-12 gap-2 px-6 py-4 items-center transition-colors hover:bg-dash-hover ${
                  entry.isCurrentUser
                    ? 'bg-sage-50 border-l-2 border-sage'
                    : i < mockLeaderboard.length - 1
                    ? 'border-b border-dash-border/50'
                    : ''
                }`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
              >
                {/* Rank */}
                <span className="col-span-1">
                  {entry.rank <= 3 ? (
                    <span className="text-lg">{rankEmojis[entry.rank]}</span>
                  ) : (
                    <span className="text-dash-muted font-medium text-sm">#{entry.rank}</span>
                  )}
                </span>

                {/* Name */}
                <div className="col-span-5 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    entry.isCurrentUser
                      ? 'bg-sage-50 border border-sage-100'
                      : 'bg-dash-hover border border-dash-border'
                  }`}>
                    <span className={`text-xs font-bold ${entry.isCurrentUser ? 'text-sage' : 'text-dash-muted'}`}>{entry.name.charAt(0)}</span>
                  </div>
                  <span className={`text-sm font-medium ${entry.isCurrentUser ? 'text-dash-text' : 'text-dash-muted'}`}>
                    {entry.name} {entry.isCurrentUser && <span className="text-sage text-xs">(You)</span>}
                  </span>
                </div>

                {/* Weekly Hours */}
                <span className={`col-span-3 text-right font-semibold text-sm ${
                  entry.isCurrentUser ? 'text-dash-text' : 'text-dash-muted'
                }`}>
                  {entry.weeklyHours}h
                </span>

                {/* Coins */}
                <div className="col-span-3 flex items-center justify-end gap-1">
                  <span className="text-xs">🪙</span>
                  <span className={`font-semibold text-sm ${entry.isCurrentUser ? 'text-sage' : 'text-dash-muted'}`}>
                    {entry.coins}
                  </span>
                </div>
              </motion.div>
            ))}
          </GlassCard>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default LeaderboardPage;
