import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import api from '../services/api';
import { LuTrophy } from 'react-icons/lu';
import { Button, Badge, Tabs, Skeleton, EmptyState, ErrorState } from '../components/ui';

const LeaderboardPage = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('week');

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/session/leaderboard?period=${period}`);
      if (res.data.success) {
        setLeaderboard(res.data.leaderboard);
      }
    } catch (err) {
      console.error('[Leaderboard] Fetch error:', err);
      setError('Failed to load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const head = (
    <div className="pg-head">
      <div>
        <p className="pg-kicker">Leaderboard</p>
        <h2 className="pg-title">{period === 'week' ? <>Top focused minds <em>this week</em></> : <>Top focused minds <em>of all time</em></>}</h2>
      </div>
      <Tabs
        variant="pill"
        label="Period"
        items={[{ value: 'week', label: 'This week' }, { value: 'all', label: 'All time' }]}
        value={period}
        onChange={setPeriod}
      />
    </div>
  );

  if (loading) {
    return (
      <PageTransition>
        {head}
        <div aria-busy="true" aria-label="Loading leaderboard">
          <div className="grid grid-cols-3 gap-6 mb-10">{[...Array(3)].map((_, i) => <Skeleton key={i} height={120} radius={10} />)}</div>
          {[...Array(6)].map((_, i) => <div key={i} className="pg-row"><Skeleton width="40%" height={14} /><Skeleton width={60} height={14} /></div>)}
        </div>
      </PageTransition>
    );
  }

  if (error) {
    return (
      <PageTransition>
        {head}
        <ErrorState title="The leaderboard didn’t load" action={<Button variant="secondary" onClick={fetchLeaderboard}>Try again</Button>}>
          {error}
        </ErrorState>
      </PageTransition>
    );
  }

  // Handle empty or single-user leaderboard
  if (leaderboard.length === 0) {
    return (
      <PageTransition>
        {head}
        <EmptyState icon={LuTrophy} title="Leaderboard is empty" action={<Button as={Link} to="/dashboard/focus">Start a session</Button>}>
          Complete focus sessions to appear on the leaderboard. Rankings are based on
          weekly focus time and coins earned.
        </EmptyState>
      </PageTransition>
    );
  }

  const topThree = leaderboard.slice(0, 3);

  return (
    <PageTransition>
      {head}

      {/* Top three */}
      <ol className="grid sm:grid-cols-3 border-y border-line-strong mb-10" aria-label="Top three">
        {topThree.map((entry, i) => (
          <li key={entry.rank} className={`py-6 sm:px-6 ${i > 0 ? 'border-t sm:border-t-0 sm:border-l border-line' : 'sm:pl-0'}`}>
            <p className={`df-mono text-t-64 leading-none ${entry.rank === 1 ? 'text-amber-ink' : 'text-muted'}`}>
              {String(entry.rank).padStart(2, '0')}
            </p>
            <p className="mt-4 text-base font-semibold text-text flex items-center gap-2">
              {entry.name}
              {entry.isCurrentUser && <Badge tone="accent">You</Badge>}
            </p>
            <p className="mt-1 text-sm text-muted">
              <span className="df-mono text-text">{entry.hours}h</span> focused · <span className="df-mono text-amber-ink">{entry.coins}</span> coins
            </p>
          </li>
        ))}
      </ol>

      {/* Full table */}
      <div className="grid grid-cols-[3rem_1fr_5rem_5rem] sm:grid-cols-[4rem_1fr_8rem_6rem] gap-4 pb-2 df-label">
        <span>Rank</span>
        <span>Name</span>
        <span className="text-right">{period === 'week' ? 'Weekly hours' : 'Total hours'}</span>
        <span className="text-right">Coins</span>
      </div>
      <ol className="pg-rows">
        {leaderboard.map((entry) => (
          <li
            key={entry.rank}
            className={`grid grid-cols-[3rem_1fr_5rem_5rem] sm:grid-cols-[4rem_1fr_8rem_6rem] gap-4 items-center py-3.5 border-b border-line ${
              entry.isCurrentUser ? 'bg-accent-soft/50 -mx-3 px-3 rounded-md' : ''
            }`}
          >
            <span className="df-mono text-sm text-muted">{String(entry.rank).padStart(2, '0')}</span>
            <span className="flex items-center gap-3 min-w-0">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${entry.isCurrentUser ? 'bg-accent text-on-accent' : 'bg-paper-2 text-muted border border-line'}`} aria-hidden="true">
                {entry.name.charAt(0)}
              </span>
              <span className="text-sm font-medium text-text truncate">
                {entry.name} {entry.isCurrentUser && <span className="text-accent text-xs font-normal">(you)</span>}
              </span>
            </span>
            <span className="df-mono text-sm text-right text-text">{entry.hours}h</span>
            <span className="df-mono text-sm text-right text-amber-ink">{entry.coins}</span>
          </li>
        ))}
      </ol>
    </PageTransition>
  );
};

export default LeaderboardPage;
