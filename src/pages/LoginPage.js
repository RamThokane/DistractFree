import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      const msg =
        err?.response?.data?.errors?.[0]?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Invalid credentials';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (tokenResponse) => {
    try {
      // googleLogin is called by GoogleAuthButton itself via AuthContext
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left: Form Side ── */}
      <div className="w-full lg:w-[45%] bg-white flex flex-col justify-center px-8 sm:px-16 py-12">
        <div className="w-full max-w-[400px] mx-auto">
          {/* Logo */}
          <Link to="/" className="inline-flex items-center gap-2.5 mb-12">
            <div className="w-9 h-9 rounded-xl bg-sage flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg tracking-tight">DistractFree</span>
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Welcome back</h1>
            <p className="text-gray-500 text-[15px]">Sign in to continue your focus journey.</p>
          </div>

          {/* Google Button */}
          <GoogleAuthButton
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google sign-in failed')}
          />

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 focus:bg-white transition-all"
                autoComplete="email"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-gray-700 text-sm font-medium">Password</label>
                <a href="#forgot" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  Forgot password?
                </a>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 focus:bg-white transition-all"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center bg-red-50 border border-red-100 rounded-xl py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium text-sm py-2.5 px-4 rounded-xl transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Footer link */}
          <p className="text-gray-500 text-sm mt-8">
            Don't have an account?{' '}
            <Link to="/register" className="text-gray-900 hover:underline font-medium">
              Create account
            </Link>
          </p>
        </div>
      </div>

      {/* ── Right: Branded Visual Side ── */}
      <div className="hidden lg:flex lg:w-[55%] bg-[#F8F9FB] relative overflow-hidden items-center justify-center">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: `radial-gradient(circle, #d1d5db 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Abstract geometric shapes */}
        <div className="absolute top-16 right-20 w-64 h-64 rounded-full bg-sage/[0.07] blur-sm" />
        <div className="absolute bottom-24 left-16 w-48 h-48 rounded-3xl bg-indigo-400/[0.06] rotate-12 blur-sm" />
        <div className="absolute top-1/3 left-1/4 w-32 h-32 rounded-2xl border-2 border-sage/10 rotate-45" />
        <div className="absolute bottom-1/3 right-1/4 w-20 h-20 rounded-full border-2 border-indigo-300/10" />
        <div className="absolute top-20 left-20 w-16 h-16 rounded-xl bg-sage/[0.05] rotate-12" />
        <div className="absolute bottom-16 right-16 w-24 h-24 rounded-full bg-indigo-300/[0.04]" />

        {/* Main content */}
        <div className="relative z-10 max-w-md px-12 text-center">
          {/* Icon cluster */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-sage/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-sage" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
          </div>

          <h2 className="text-[28px] font-semibold text-gray-800 leading-tight mb-4">
            Block distractions.<br />
            Earn control.<br />
            Build discipline.
          </h2>
          <p className="text-gray-500 text-[15px] leading-relaxed">
            DistractFree uses AI-powered focus sessions and a coin reward system to help you build sustainable productivity habits.
          </p>

          {/* Social proof pill */}
          <div className="inline-flex items-center gap-2 mt-8 bg-white border border-gray-200 rounded-full px-5 py-2 shadow-sm">
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-sage/20 border-2 border-white flex items-center justify-center">
                <span className="text-[8px] font-bold text-sage">A</span>
              </div>
              <div className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center">
                <span className="text-[8px] font-bold text-indigo-400">M</span>
              </div>
              <div className="w-6 h-6 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center">
                <span className="text-[8px] font-bold text-amber-500">S</span>
              </div>
            </div>
            <span className="text-gray-600 text-xs font-medium">Join 2,400+ focused users</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
