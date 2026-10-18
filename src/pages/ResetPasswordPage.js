import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LuCheck, LuCircleAlert, LuDot } from 'react-icons/lu';
import api from '../services/api';
import AuthLayout, { friendlyAuthError } from '../components/AuthLayout';
import { Button, Input } from '../components/ui';

/* Same rules as sign-up and the server */
const PASSWORD_RULES = [
  ['At least 8 characters', (p) => p.length >= 8],
  ['A letter', (p) => /[a-zA-Z]/.test(p)],
  ['A number', (p) => /\d/.test(p)],
];

const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const linkLooksValid = /^[a-f0-9]{64}$/.test(token) && email.includes('@');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const passed = PASSWORD_RULES.filter(([, test]) => test(password)).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    const failed = PASSWORD_RULES.find(([, test]) => !test(password));
    if (!password) errs.password = 'Choose a new password.';
    else if (failed) errs.password = `Your password needs: ${failed[0].toLowerCase()}.`;
    if (!confirm) errs.confirm = 'Type the new password again.';
    else if (confirm !== password) errs.confirm = 'Passwords do not match';
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { email, token, password });
      setDone(true);
    } catch (err) {
      setError(friendlyAuthError(err, 'This reset link is invalid or has expired. Ask for a new one.'));
    } finally {
      setLoading(false);
    }
  };

  if (!linkLooksValid) {
    return (
      <AuthLayout
        title="This link doesn’t work"
        subtitle="It may be incomplete, or it was copied without its last part."
        footer={<Link to="/login" className="df-link">Back to sign in</Link>}
      >
        <Button as={Link} to="/forgot-password" size="lg" block>Send a new reset link</Button>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password updated" subtitle="Your new password works now. Sign in with it to get back to your dashboard.">
        <Button as={Link} to="/login" size="lg" block>Sign in</Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={<>For <span className="text-text font-medium">{email}</span></>}
      footer={<>Changed your mind? <Link to="/login" className="df-link">Back to sign in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <Input
            label="New password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFieldErrors((f) => ({ ...f, password: undefined })); }}
            autoComplete="new-password"
            autoFocus
            error={fieldErrors.password}
          />
          <div className="mt-3" aria-live="polite">
            <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
              {PASSWORD_RULES.map((_, i) => (
                <span key={i} className={`h-1 rounded-full ${i < passed ? (passed === 3 ? 'bg-accent' : 'bg-amber') : 'bg-paper-3'}`} />
              ))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {PASSWORD_RULES.map(([label, test]) => {
                const ok = test(password);
                return (
                  <li key={label} className={`flex items-center gap-1 text-xs ${ok ? 'text-accent' : 'text-muted'}`}>
                    {ok ? <LuCheck aria-hidden="true" /> : <LuDot aria-hidden="true" />}
                    {label}<span className="sr-only">{ok ? ' — done' : ' — not yet'}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <Input
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setFieldErrors((f) => ({ ...f, confirm: undefined })); }}
          autoComplete="new-password"
          error={fieldErrors.confirm}
        />

        {error && (
          <div role="alert" className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2.5">
            <p className="flex items-start gap-2"><LuCircleAlert className="mt-0.5 flex-shrink-0" aria-hidden="true" />{error}</p>
            <Link to="/forgot-password" className="df-link mt-1.5 ml-6 inline-block">Send a new link</Link>
          </div>
        )}

        <Button type="submit" size="lg" block loading={loading}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
