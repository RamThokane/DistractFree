import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/\d/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }
    if (!/[a-zA-Z]/.test(password)) {
      setError('Password must contain at least one letter');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err) {
      // Show actual backend validation error
      const msg =
        err?.response?.data?.errors?.[0]?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (tokenResponse) => {
    try {
      navigate('/dashboard');
    } catch {
      setError('Google sign-in failed');
    }
  };

  const inputClass =
    'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 focus:bg-white transition-all';

  return (
    <div className="min-h-screen flex">
      {/* ── Left: Form Side ── */}
      <div className="w-full lg:w-[45%] bg-white flex flex-col justify-center px-8 sm:px-16 py-12">
        <div className="w-full max-w-[400px] mx-auto">
          {/* Logo */}
          <Link to="/" className="inline-flex items-center gap-2.5 mb-10">
            <div className="w-9 h-9 rounded-xl bg-sage flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg tracking-tight">DistractFree</span>
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Create your account</h1>
            <p className="text-gray-500 text-[15px]">Start building sustainable focus habits.</p>
          </div>

          {/* Google Button */}
          <GoogleAuthButton
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google sign-in failed')}
            label="Continue with Google"
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
              <label className="block text-gray-700 text-sm font-medium mb-1.5">Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera" className={inputClass} autoComplete="name" />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" className={inputClass} autoComplete="email" />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" className={inputClass} autoComplete="new-password" />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1.5">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••" className={inputClass} autoComplete="new-password" />
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
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          {/* Footer link */}
          <p className="text-gray-500 text-sm mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-gray-900 hover:underline font-medium">
              Sign in
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
        <div className="absolute top-20 left-16 w-56 h-56 rounded-full bg-sage/[0.07] blur-sm" />
        <div className="absolute bottom-20 right-20 w-44 h-44 rounded-3xl bg-indigo-400/[0.06] -rotate-12 blur-sm" />
        <div className="absolute top-1/4 right-1/3 w-28 h-28 rounded-2xl border-2 border-sage/10 rotate-45" />
        <div className="absolute bottom-1/4 left-1/4 w-20 h-20 rounded-full border-2 border-indigo-300/10" />
        <div className="absolute bottom-12 left-12 w-16 h-16 rounded-xl bg-sage/[0.05] -rotate-12" />
        <div className="absolute top-16 right-16 w-24 h-24 rounded-full bg-indigo-300/[0.04]" />

        {/* Main content */}
        <div className="relative z-10 max-w-md px-12 text-center">
          {/* Feature cards stack */}
          <div className="space-y-3 mb-8">
            {[
              { icon: '🛡️', text: 'Smart website blocking during focus sessions' },
              { icon: '🪙', text: 'Earn coins for staying focused, spend on breaks' },
              { icon: '📊', text: 'AI-powered insights track your progress' },
            ].map((item, i) => (
              <div key={i} className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-5 py-3 shadow-sm w-full text-left">
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <span className="text-gray-700 text-sm">{item.text}</span>
              </div>
            ))}
          </div>

          <h2 className="text-[28px] font-semibold text-gray-800 leading-tight mb-4">
            Your focus,<br />
            rewarded.
          </h2>
          <p className="text-gray-500 text-[15px] leading-relaxed">
            Join thousands who've transformed their digital habits with AI-powered focus sessions and a gamified reward system.
          </p>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-8 mt-8">
            <div className="text-center">
              <p className="text-xl font-bold text-gray-800">2.4K+</p>
              <p className="text-gray-400 text-xs">Active users</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-xl font-bold text-gray-800">1.2M</p>
              <p className="text-gray-400 text-xs">Focus minutes</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-xl font-bold text-gray-800">94%</p>
              <p className="text-gray-400 text-xs">Improvement</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
