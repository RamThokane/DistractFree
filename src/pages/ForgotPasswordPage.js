import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LuCircleAlert, LuMailCheck } from 'react-icons/lu';
import api from '../services/api';
import AuthLayout, { friendlyAuthError, isEmail } from '../components/AuthLayout';
import { Button, Input } from '../components/ui';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return setFieldError('Enter the email you signed up with.');
    if (!isEmail(email)) return setFieldError('That doesn’t look like an email address.');
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(friendlyAuthError(err, 'We couldn’t send the link. Try again in a moment.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={sent ? 'Check your email' : 'Forgot your password?'}
      subtitle={sent ? undefined : 'Enter your email and we’ll send you a link to choose a new one.'}
      footer={<>Remembered it? <Link to="/login" className="df-link">Back to sign in</Link></>}
    >
      {sent ? (
        <div className="mt-6" role="status">
          <div className="flex items-start gap-3 rounded-lg bg-accent-soft px-4 py-4">
            <LuMailCheck className="mt-0.5 text-accent flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-text leading-relaxed">
              If an account exists for <span className="font-semibold">{email.trim()}</span>, a reset link is on its way.
              It works once, for 30 minutes.
            </p>
          </div>
          <p className="text-sm text-muted mt-5 leading-relaxed">
            Nothing after a few minutes? Check your spam folder, or{' '}
            <button type="button" className="df-link" onClick={() => setSent(false)}>try a different email</button>.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFieldError(''); }}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            error={fieldError || undefined}
          />
          {error && (
            <p role="alert" className="flex items-start gap-2 text-sm text-danger bg-danger-soft rounded-md px-3 py-2.5">
              <LuCircleAlert className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          <Button type="submit" size="lg" block loading={loading}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
