import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';
import AuthLayout, { friendlyAuthError, isEmail } from '../components/AuthLayout';
import { Button, Input } from '../components/ui';
import { LuCircleAlert } from 'react-icons/lu';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!email) errs.email = 'Enter your email.';
    else if (!isEmail(email)) errs.email = 'That doesn’t look like an email address.';
    if (!password) errs.password = 'Enter your password.';
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(friendlyAuthError(err, 'That email and password don’t match. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async () => {
    try {
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue your focus journey."
      footer={<>Don't have an account? <Link to="/register" className="df-link">Create account</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setFieldErrors((f) => ({ ...f, email: undefined })); }}
          placeholder="you@example.com"
          autoComplete="email"
          error={fieldErrors.email}
        />
        <div>
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFieldErrors((f) => ({ ...f, password: undefined })); }}
            autoComplete="current-password"
            error={fieldErrors.password}
          />
          <p className="mt-2 text-right">
            <Link to="/forgot-password" className="df-link text-sm">Forgot password?</Link>
          </p>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-danger bg-danger-soft rounded-md px-3 py-2.5">
            <LuCircleAlert className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <Button type="submit" size="lg" block loading={loading}>
          Sign in
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

export default LoginPage;
