import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LuCheck, LuCircleAlert, LuDot } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';
import AuthLayout, { friendlyAuthError, isEmail } from '../components/AuthLayout';
import { Button, Input } from '../components/ui';

/* Same rules the form enforces on submit */
const PASSWORD_RULES = [
  ['At least 8 characters', (p) => p.length >= 8],
  ['A letter', (p) => /[a-zA-Z]/.test(p)],
  ['A number', (p) => /\d/.test(p)],
];

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const clear = (key) => setFieldErrors((f) => ({ ...f, [key]: undefined }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!name.trim()) errs.name = 'Tell us what to call you.';
    if (!email) errs.email = 'Enter your email.';
    else if (!isEmail(email)) errs.email = 'That doesn’t look like an email address.';
    if (!password) errs.password = 'Choose a password.';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    else if (!/\d/.test(password)) errs.password = 'Password must contain at least one number';
    else if (!/[a-zA-Z]/.test(password)) errs.password = 'Password must contain at least one letter';
    if (!confirmPassword) errs.confirm = 'Type your password again.';
    else if (password !== confirmPassword) errs.confirm = 'Passwords do not match';
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setError('');
    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(friendlyAuthError(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async () => {
    try {
      navigate('/dashboard');
    } catch {
      setError('Google sign-in failed');
    }
  };

  const passed = PASSWORD_RULES.filter(([, test]) => test(password)).length;

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start building sustainable focus habits."
      footer={<>Already have an account? <Link to="/login" className="df-link">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input label="Full name" value={name} onChange={(e) => { setName(e.target.value); clear('name'); }} placeholder="Alex Rivera" autoComplete="name" error={fieldErrors.name} />
        <Input label="Email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); clear('email'); }} placeholder="you@example.com" autoComplete="email" error={fieldErrors.email} />

        <div>
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); clear('password'); }}
            autoComplete="new-password"
            error={fieldErrors.password}
          />
          {/* Strength hint */}
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
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); clear('confirm'); }}
          autoComplete="new-password"
          error={fieldErrors.confirm || (confirmPassword && password && confirmPassword.length >= password.length && confirmPassword !== password ? 'Passwords do not match' : undefined)}
        />

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-danger bg-danger-soft rounded-md px-3 py-2.5">
            <LuCircleAlert className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <Button type="submit" size="lg" block loading={loading}>
          Create account
        </Button>
      </form>

      <div className="flex items-center gap-4 my-7" role="separator">
        <span className="flex-1 h-px bg-line" />
        <span className="text-xs text-muted">or</span>
        <span className="flex-1 h-px bg-line" />
      </div>

      <GoogleAuthButton
        onSuccess={handleGoogleSuccess}
        onError={(err) => setError(friendlyAuthError(err, 'Google sign-in failed. Try again, or use your email.'))}
      />
    </AuthLayout>
  );
};

export default RegisterPage;
