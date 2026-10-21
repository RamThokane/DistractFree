import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { load as loadCashfree } from '@cashfreepayments/cashfree-js';
import { LuCrown, LuCheck, LuInfinity, LuCircleAlert, LuLoaderCircle } from 'react-icons/lu';
import PageTransition from '../components/PageTransition';
import { Badge, Button, Card, Input, Skeleton, SkeletonText, ErrorState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const PHONE_KEY = 'df_pay_phone';
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / (24 * 60 * 60 * 1000)));

const readPhone = () => { try { return localStorage.getItem(PHONE_KEY) || ''; } catch { return ''; } };
const savePhone = (p) => { try { localStorage.setItem(PHONE_KEY, p); } catch { /* private mode */ } };

/* ── Result of returning from Cashfree checkout ── */
const PaymentResult = ({ state, premiumUntil }) => {
  if (state === 'checking') {
    return (
      <Card variant="band" padding="p-5" className="flex items-center gap-3 mb-8" role="status">
        <LuLoaderCircle className="animate-spin text-accent" size={20} aria-hidden="true" />
        <p className="text-sm text-text">Confirming your payment with Cashfree…</p>
      </Card>
    );
  }
  if (state === 'paid') {
    return (
      <Card variant="band" padding="p-5" className="flex items-center gap-3 mb-8" role="status">
        <LuCheck className="text-accent flex-shrink-0" size={20} aria-hidden="true" />
        <p className="text-sm text-text">Payment successful. You're Premium until <strong>{fmtDate(premiumUntil)}</strong>.</p>
      </Card>
    );
  }
  if (state === 'pending') {
    return (
      <Card variant="band" padding="p-5" className="flex items-center gap-3 mb-8" role="status">
        <LuCircleAlert className="text-amber-ink flex-shrink-0" size={20} aria-hidden="true" />
        <p className="text-sm text-text">We haven't received the payment yet. If you paid, it will show here within a few minutes. Refresh to check again.</p>
      </Card>
    );
  }
  return (
    <Card variant="band" padding="p-5" className="flex items-center gap-3 mb-8" role="alert">
      <LuCircleAlert className="text-danger flex-shrink-0" size={20} aria-hidden="true" />
      <p className="text-sm text-text">The payment didn't go through, and Premium wasn't added. You can try again below.</p>
    </Card>
  );
};

const PremiumPage = () => {
  const { user, updateUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [phone, setPhone] = useState(readPhone);
  const [phoneError, setPhoneError] = useState('');
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState(null); // null | 'checking' | 'paid' | 'pending' | 'failed'

  const fetchStatus = useCallback(async () => {
    try {
      setLoadError(false);
      const res = await api.get('/premium/status');
      setStatus(res.data);
      return res.data;
    } catch {
      setLoadError(true);
      return null;
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Back from Cashfree: ?order_id=… → ask our server (which asks Cashfree) how it went
  useEffect(() => {
    const orderId = searchParams.get('order_id');
    if (!orderId) return;
    setSearchParams({}, { replace: true });
    let alive = true;
    (async () => {
      setResult('checking');
      // The webhook and the return can race; give a pending payment a few seconds
      for (let attempt = 0; attempt < 5 && alive; attempt++) {
        try {
          const res = await api.post('/premium/verify', { orderId });
          const s = res.data.payment?.status;
          if (s === 'paid' || s === 'failed') {
            if (!alive) return;
            setResult(s);
            if (s === 'paid' && user) updateUser({ ...user, plan: { name: res.data.plan, dailyChats: res.data.dailyLimit, premiumUntil: res.data.premiumUntil } });
            fetchStatus();
            return;
          }
        } catch { /* try again */ }
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (alive) setResult('pending');
    })();
    return () => { alive = false; };
    // Runs once for the order id in the address
  }, []);

  const pay = async (e) => {
    e.preventDefault();
    // Same rules as the server: Indian → 10 digits, abroad → + country code + number
    const s = phone.replace(/[\s\-().]/g, '').replace(/^00/, '+');
    const indian = s.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
    const digits = indian ? indian[1] : /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
    if (!digits) {
      setPhoneError('Enter a valid mobile number. Outside India, start with + and your country code.');
      return;
    }
    setPhoneError('');
    setPaying(true);
    try {
      const res = await api.post('/premium/order', { phone: digits });
      savePhone(digits);
      const cashfree = await loadCashfree({ mode: res.data.mode });
      // Leaves the site; Cashfree sends the user back to /dashboard/premium?order_id=…
      await cashfree.checkout({ paymentSessionId: res.data.paymentSessionId, redirectTarget: '_self' });
    } catch (err) {
      setPhoneError(err.response?.data?.message || 'Couldn’t open the payment page. Please try again.');
      setPaying(false);
    }
  };

  if (loadError && !status) {
    return (
      <PageTransition>
        <ErrorState title="Premium didn’t load" action={<Button variant="secondary" onClick={fetchStatus}>Try again</Button>}>
          Check your connection, then try again.
        </ErrorState>
      </PageTransition>
    );
  }

  const plan = status?.plan;
  const isPremium = plan === 'premium';

  return (
    <PageTransition>
      <div className="pg-head">
        <div>
          <p className="pg-kicker">Plan</p>
          <h2 className="pg-title">Distract<em>Free</em> Premium</h2>
          <p className="pg-sub">More time with your focus coach. One payment, no auto-renewal.</p>
        </div>
      </div>

      {result && <PaymentResult state={result} premiumUntil={status?.premiumUntil} />}

      {!status ? (
        <div className="grid lg:grid-cols-2 gap-8"><Skeleton height={260} radius={10} /><Skeleton height={260} radius={10} /></div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* ── Current plan ── */}
          <Card padding="p-6 md:p-7">
            <p className="df-label">Your plan</p>
            {plan === 'owner' ? (
              <>
                <p className="df-display text-t-40 mt-3 flex items-center gap-3">Unlimited <LuInfinity className="text-accent" aria-hidden="true" /></p>
                <p className="pg-note mt-3">Owner account: unlimited focus coach chats, no payment needed.</p>
              </>
            ) : isPremium ? (
              <>
                <p className="df-display text-t-40 mt-3 flex items-center gap-3">Premium <LuCrown className="text-amber-ink" aria-hidden="true" /></p>
                <p className="text-sm text-text-2 mt-3">
                  {status.premiumDailyChats} chats a day until <strong className="text-text">{fmtDate(status.premiumUntil)}</strong>
                  {' '}· {daysLeft(status.premiumUntil)} day{daysLeft(status.premiumUntil) === 1 ? '' : 's'} left
                </p>
              </>
            ) : (
              <>
                <p className="df-display text-t-40 mt-3">Free</p>
                <p className="text-sm text-text-2 mt-3">{status.freeDailyChats} focus coach chats a day.</p>
                {status.premiumUntil && <p className="pg-note mt-2">Your Premium ended on {fmtDate(status.premiumUntil)}.</p>}
              </>
            )}
            <Link to="/dashboard/coach" className="df-link df-link--arrow text-sm mt-6 inline-block">Open the focus coach</Link>
          </Card>

          {/* ── Buy / extend ── */}
          {plan !== 'owner' && (
            <Card variant="band" padding="p-6 md:p-7">
              <div className="flex items-baseline justify-between gap-4">
                <p className="df-label">Premium · {status.days} days</p>
                {isPremium && <Badge tone="accent">Active</Badge>}
              </div>
              <p className="df-mono text-t-40 text-text mt-3">₹{status.price}<span className="text-sm text-muted ml-2">one-time</span></p>
              <ul className="mt-5 space-y-2.5 text-sm text-text-2">
                <li className="flex gap-2.5"><LuCheck className="mt-0.5 flex-shrink-0 text-accent" aria-hidden="true" />{status.premiumDailyChats} focus coach chats a day (free: {status.freeDailyChats})</li>
                <li className="flex gap-2.5"><LuCheck className="mt-0.5 flex-shrink-0 text-accent" aria-hidden="true" />Starts right after payment, lasts {status.days} days</li>
                <li className="flex gap-2.5"><LuCheck className="mt-0.5 flex-shrink-0 text-accent" aria-hidden="true" />No auto-renewal. Buying again adds {status.days} more days</li>
              </ul>

              {status.paymentsEnabled ? (
                <form onSubmit={pay} className="mt-6" noValidate>
                  <Input
                    label="Mobile number"
                    type="tel"
                    autoComplete="tel"
                    placeholder="98765 43210 or +1 415 555 0100"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
                    error={phoneError}
                    hint="Outside India? Start with + and your country code. Cashfree needs it for the payment."
                  />
                  <Button type="submit" block className="mt-4" loading={paying} icon={<LuCrown size={16} aria-hidden="true" />}>
                    {isPremium ? `Extend for ₹${status.price}` : `Pay ₹${status.price}`}
                  </Button>
                  <p className="text-xs text-muted mt-3">
                    Secure payment by Cashfree: UPI, cards and net banking in India; international cards elsewhere. By paying you agree to the{' '}
                    <Link to="/terms" className="df-link">Terms</Link> and{' '}
                    <Link to="/refund" className="df-link">Refund Policy</Link>.
                  </p>
                </form>
              ) : (
                <p className="pg-note mt-6">Payments aren't available right now. Please check back soon.</p>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ── Payment history ── */}
      {status && plan !== 'owner' && (
        <section className="mt-10" aria-labelledby="payments-title">
          <div className="pg-section-head">
            <h3 id="payments-title" className="pg-h2">Payments</h3>
          </div>
          {status.payments.length === 0 ? (
            <p className="pg-note">No payments yet.</p>
          ) : (
            <div>
              {status.payments.map((p) => (
                <div key={p.orderId} className="pg-row">
                  <div className="pg-row-main">
                    <p className="pg-row-title">Premium · {fmtDate(p.paidAt || p.createdAt)}</p>
                    <p className="pg-row-meta">Order {p.orderId}{p.premiumUntil ? ` · until ${fmtDate(p.premiumUntil)}` : ''}</p>
                  </div>
                  <span className="pg-amount">₹{p.amount}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {!status && !loadError && <SkeletonText className="mt-10" lines={3} />}
    </PageTransition>
  );
};

export default PremiumPage;
