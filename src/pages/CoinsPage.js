import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AnimatedCounter from '../components/AnimatedCounter';
import PageTransition from '../components/PageTransition';
import { useCoins } from '../context/CoinContext';
import api from '../services/api';
import { formatRelativeTime } from '../utils/helpers';
import { LuCoins } from 'react-icons/lu';
import { Button, Badge, Skeleton, EmptyState, ErrorState } from '../components/ui';

const CoinsPage = () => {
  const { balance, refreshBalance } = useCoins();
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [welcome, setWelcome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [historyRes, summaryRes] = await Promise.all([
        api.get('/coins/history'),
        api.get('/coins/summary'),
      ]);

      if (historyRes.data.success) {
        setTransactions(historyRes.data.transactions);
        setPage(1);
        setHasMore(historyRes.data.pagination?.pages > 1);
      }
      if (summaryRes.data.success) {
        setSummary(summaryRes.data.summary);
        setWelcome(summaryRes.data.welcomeBonus || null);
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

  // Older transactions are paginated (30 per page) — load them on demand
  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const next = page + 1;
      const res = await api.get(`/coins/history?page=${next}`);
      if (res.data.success) {
        setTransactions((prev) => [...prev, ...res.data.transactions]);
        setPage(next);
        setHasMore(next < res.data.pagination.pages);
      }
    } catch (err) {
      console.error('[Coins] Load more error:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const TYPE_LABEL = { earned: 'Earned', spent: 'Unlock', bonus: 'Bonus', penalty: 'Penalty' };
  const isWelcome = (tx) => tx.type === 'bonus' && /^Welcome bonus/.test(tx.description || '');
  const TYPE_TONE = { earned: 'accent', spent: 'neutral', bonus: 'amber', penalty: 'danger' };
  const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const fmtClock = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <PageTransition>
      <div className="max-w-5xl">
        {/* ── Balance ── */}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-end">
          <section className="lg:col-span-6" aria-labelledby="balance-label">
            <p id="balance-label" className="pg-kicker">Your Focus Coin balance</p>
            <p className="df-mono text-t-64 md:text-t-88 leading-none text-amber-ink">
              <AnimatedCounter value={balance} duration={0.9} />
            </p>
            <p className="pg-sub">Earn coins through focus sessions, spend them on controlled breaks.</p>
            {welcome && (
              <p className="mt-3 inline-flex items-center gap-2 text-sm text-text-2">
                <Badge tone="amber" mono>+{welcome.amount}</Badge>
                Welcome bonus, received {new Date(welcome.receivedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </section>

          {/* ── Summary ── */}
          <dl className="lg:col-span-6 pg-stats" aria-label="Summary">
            {[
              ['Total earned', summary ? `+${summary.earned?.total || 0}` : '—', summary ? `${summary.earned?.count || 0} transactions` : '', 'text-amber-ink'],
              ['Total spent', summary ? `−${summary.spent?.total || 0}` : '—', summary ? `${summary.spent?.count || 0} unlocks` : '', 'text-text'],
              ['Bonuses', summary ? `+${summary.bonus?.total || 0}` : '—', summary ? (welcome ? `incl. +${welcome.amount} welcome bonus` : `${summary.bonus?.count || 0} bonuses`) : '', 'text-amber-ink'],
              ['Penalties', summary ? `−${summary.penalty?.total || 0}` : '—', summary ? `${summary.penalty?.count || 0} penalties` : '', 'text-danger'],
            ].map(([label, value, sub, tone]) => (
              <div key={label}>
                <dt className="df-label">{label}</dt>
                <dd className={`df-mono text-t-28 mt-1 ${tone}`}>{value}</dd>
                <dd className="text-xs text-muted mt-0.5">{sub}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── Ledger ── */}
        <section className="pg-section" aria-labelledby="ledger-title">
          <div className="pg-section-head">
            <h2 id="ledger-title" className="pg-h2">Transaction history</h2>
            {!loading && !error && transactions.length > 0 && (
              <span className="df-mono text-xs text-muted">{transactions.length} shown</span>
            )}
          </div>

          {loading ? (
            <div aria-busy="true" aria-label="Loading transactions">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="pg-row">
                  <div className="flex-1"><Skeleton width="45%" height={14} /><Skeleton className="mt-2" width="22%" height={10} /></div>
                  <Skeleton width={48} height={14} />
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorState title="Your coin history didn’t load" action={<Button variant="secondary" size="sm" onClick={fetchData}>Try again</Button>}>
              {error} Your balance is safe; this is only the list.
            </ErrorState>
          ) : transactions.length === 0 ? (
            <EmptyState icon={LuCoins} title="No transactions yet" action={<Button as={Link} to="/dashboard/focus" size="sm">Start a session</Button>}>
              Complete your first focus session to earn coins. Every coin you earn or spend will be listed here.
            </EmptyState>
          ) : (
            <>
              {/* Column labels (desktop) */}
              <div className="hidden md:grid grid-cols-[7rem_1fr_7rem_6rem] gap-4 pb-2 df-label">
                <span>Date</span><span>Reason</span><span>Type</span><span className="text-right">Amount</span>
              </div>
              <ul className="pg-rows">
                {transactions.map((tx) => (
                  <li key={tx._id} className="grid grid-cols-[1fr_auto] md:grid-cols-[7rem_1fr_7rem_6rem] items-center gap-x-4 gap-y-1 py-3.5 border-b border-line">
                    <span className="hidden md:block df-mono text-xs text-muted" title={formatRelativeTime(tx.createdAt)}>
                      {fmtDate(tx.createdAt)} <span className="opacity-70">{fmtClock(tx.createdAt)}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-text truncate">{isWelcome(tx) ? `Welcome bonus — your first ${tx.amount} Focus Coins` : (tx.description || TYPE_LABEL[tx.type] || tx.type)}</span>
                      <span className="md:hidden block df-mono text-xs text-muted mt-0.5">{fmtDate(tx.createdAt)} · {fmtClock(tx.createdAt)}</span>
                    </span>
                    <span className="hidden md:block"><Badge tone={TYPE_TONE[tx.type] || 'neutral'}>{TYPE_LABEL[tx.type] || tx.type}</Badge></span>
                    <span className={`pg-amount text-right ${tx.amount > 0 ? 'pg-amount--coin' : 'pg-amount--minus'}`}>
                      {tx.amount > 0 ? '+' : '−'}{Math.abs(tx.amount)}
                    </span>
                  </li>
                ))}
              </ul>
              {hasMore && (
                <div className="mt-5">
                  <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                    Load older transactions
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </PageTransition>
  );
};

export default CoinsPage;
