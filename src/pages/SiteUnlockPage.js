import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { load as loadCashfree } from '@cashfreepayments/cashfree-js';
import { LuCheck, LuCircleAlert, LuHeart, LuLoaderCircle, LuLock } from 'react-icons/lu';
import PageTransition from '../components/PageTransition';
import { Button, Card, Input, Skeleton, ErrorState } from '../components/ui';
import api from '../services/api';

/*
 * Strict-mode ₹49 unlock, opened from the extension's block page once the
 * free 2-minute pass for a site is used up. The money is donated to charity;
 * the site stays open until the focus session ends. No refunds.
 */

const PHONE_KEY = 'df_pay_phone';
const RETURN_KEY = 'df_unlock_return'; // { domain, url } kept across the Cashfree redirect

const readPhone = () => { try { return localStorage.getItem(PHONE_KEY) || ''; } catch { return ''; } };
const savePhone = (p) => { try { localStorage.setItem(PHONE_KEY, p); } catch { /* private mode */ } };
const readReturn = () => { try { return JSON.parse(sessionStorage.getItem(RETURN_KEY) || 'null'); } catch { return null; } };
const saveReturn = (r) => { try { sessionStorage.setItem(RETURN_KEY, JSON.stringify(r)); } catch { /* private mode */ } };

/** Only send the user back to the site being unlocked. */
function siteLink(domain, url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (/^https?:$/.test(u.protocol) && (host === domain || host.endsWith(`.${domain}`))) return u.toString();
  } catch { /* not a url */ }
  return `https://${domain}`;
}

/** Ask the extension to pick up the unlock; resolves when it has (or after a few seconds). */
const syncExtension = () => new Promise((resolve) => {
  const done = () => { window.removeEventListener('DF_UNLOCKS_SYNCED', done); resolve(); };
  window.addEventListener('DF_UNLOCKS_SYNCED', done);
  window.dispatchEvent(new CustomEvent('DF_UNLOCKS_CHANGED'));
  setTimeout(done, 4000);
});

const Notice = ({ tone = 'info', children }) => {
  const Icon = tone === 'ok' ? LuCheck : tone === 'wait' ? LuLoaderCircle : LuCircleAlert;
  const color = tone === 'ok' ? 'text-accent' : tone === 'error' ? 'text-danger' : tone === 'wait' ? 'text-accent animate-spin' : 'text-amber-ink';
  return (
    <Card variant="band" padding="p-5" className="flex items-center gap-3 mb-8" role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className={`${color} flex-shrink-0`} size={20} aria-hidden="true" />
      <p className="text-sm text-text">{children}</p>
    </Card>
  );
};

const SiteUnlockPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [target] = useState(() => {
    const domain = (searchParams.get('domain') || '').toLowerCase();
    if (domain) return { domain, url: searchParams.get('url') || '' };
    return readReturn() || { domain: '', url: '' };
  });
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [phone, setPhone] = useState(readPhone);
  const [phoneError, setPhoneError] = useState('');
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState(null); // null | 'checking' | 'paid' | 'pending' | 'failed'

  const { domain } = target;
  const openUrl = domain ? siteLink(domain, target.url) : null;

  const fetchStatus = useCallback(async () => {
    try {
      setLoadError(false);
      const res = await api.get('/site-unlock/status');
      setStatus(res.data);
    } catch {
      setLoadError(true);
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
      for (let attempt = 0; attempt < 5 && alive; attempt++) {
        try {
          const res = await api.post('/site-unlock/verify', { orderId });
          const s = res.data.payment?.status;
          if (s === 'paid' || s === 'failed') {
            if (!alive) return;
            setResult(s);
            fetchStatus();
            if (s === 'paid') {
              await syncExtension();
              const paidDomain = res.data.payment.domain;
              if (alive && paidDomain) window.location.href = siteLink(paidDomain, readReturn()?.url || '');
            }
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
      const res = await api.post('/site-unlock/order', { domain, phone: digits });
      savePhone(digits);
      saveReturn({ domain: res.data.domain, url: target.url });
      const cashfree = await loadCashfree({ mode: res.data.mode });
      // Leaves the site; Cashfree sends the user back to /dashboard/unlock?order_id=…
      await cashfree.checkout({ paymentSessionId: res.data.paymentSessionId, redirectTarget: '_self' });
    } catch (err) {
      setPhoneError(err.response?.data?.message || 'Couldn’t open the payment page. Please try again.');
      setPaying(false);
    }
  };

  if (loadError && !status) {
    return (
      <PageTransition>
        <ErrorState title="This page didn’t load" action={<Button variant="secondary" onClick={fetchStatus}>Try again</Button>}>
          Check your connection, then try again.
        </ErrorState>
      </PageTransition>
    );
  }

  const price = status?.price ?? 49;
  const alreadyPaid = Boolean(domain && status?.paidDomains?.includes(domain));
  const pass = status?.passes?.find((p) => p.domain === domain);

  return (
    <PageTransition>
      <div className="pg-head">
        <div>
          <p className="pg-kicker">Strict mode</p>
          <h2 className="pg-title">Unlock {domain ? <em>{domain}</em> : 'a site'}</h2>
          <p className="pg-sub">Your free 2-minute pass is used. Unlock the site until this focus session ends, or get back to work.</p>
        </div>
      </div>

      {result === 'checking' && <Notice tone="wait">Confirming your payment with Cashfree…</Notice>}
      {result === 'paid' && <Notice tone="ok">Payment received, thank you. Your ₹{price} goes to charity. Opening the site…</Notice>}
      {result === 'pending' && <Notice>We haven't received the payment yet. If you paid, it will show here within a few minutes. Refresh to check again.</Notice>}
      {result === 'failed' && <Notice tone="error">The payment didn't go through, so the site is still paused. You can try again below.</Notice>}

      {!status ? (
        <Skeleton height={300} radius={10} />
      ) : !status.focusStrict ? (
        <Card padding="p-6 md:p-7">
          <p className="df-label">Not available right now</p>
          <p className="text-sm text-text-2 mt-3">Paid unlocks are only for strict mode during a focus session. Outside a session, blocked sites stay blocked.</p>
          <Link to="/dashboard/focus" className="df-link df-link--arrow text-sm mt-6 inline-block">Go to focus</Link>
        </Card>
      ) : !domain ? (
        <Card padding="p-6 md:p-7">
          <p className="text-sm text-text-2">Open a blocked site and choose “Unlock for ₹{price}” on the block page.</p>
        </Card>
      ) : alreadyPaid ? (
        <Card padding="p-6 md:p-7">
          <p className="df-label">Unlocked</p>
          <p className="text-sm text-text-2 mt-3">{domain} is open until this focus session ends.</p>
          <Button className="mt-6" onClick={async () => { await syncExtension(); window.location.href = openUrl; }}>Open {domain}</Button>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <Card padding="p-6 md:p-7">
            <p className="df-label flex items-center gap-2"><LuLock size={14} aria-hidden="true" /> What you get</p>
            <ul className="mt-5 space-y-2.5 text-sm text-text-2">
              <li className="flex gap-2.5"><LuCheck className="mt-0.5 flex-shrink-0 text-accent" aria-hidden="true" />{domain} opens until this focus session ends</li>
              <li className="flex gap-2.5"><LuHeart className="mt-0.5 flex-shrink-0 text-accent" aria-hidden="true" />The full ₹{price} is donated to charity</li>
              <li className="flex gap-2.5"><LuCircleAlert className="mt-0.5 flex-shrink-0 text-amber-ink" aria-hidden="true" />No refunds</li>
            </ul>
            <Button variant="secondary" className="mt-6" onClick={() => navigate('/dashboard/focus')}>Stay focused</Button>
          </Card>

          <Card variant="band" padding="p-6 md:p-7">
            <p className="df-label">Unlock {domain}</p>
            <p className="df-mono text-t-40 text-text mt-3">₹{price}<span className="text-sm text-muted ml-2">to charity</span></p>
            {pass && new Date(pass.expiresAt) > new Date() && (
              <p className="pg-note mt-3">Your free pass for this site is still running.</p>
            )}
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
                <Button type="submit" block className="mt-4" loading={paying}>Pay ₹{price} and unlock</Button>
                <p className="text-xs text-muted mt-3">
                  Secure payment by Cashfree. Non-refundable. By paying you agree to the{' '}
                  <Link to="/terms" className="df-link">Terms</Link> and{' '}
                  <Link to="/refund" className="df-link">Refund Policy</Link>.
                </p>
              </form>
            ) : (
              <p className="pg-note mt-6">Payments aren't available right now, so the site stays paused.</p>
            )}
          </Card>
        </div>
      )}
    </PageTransition>
  );
};

export default SiteUnlockPage;
