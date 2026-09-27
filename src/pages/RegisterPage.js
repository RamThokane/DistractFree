import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';
import AuthShowcase from '../components/AuthShowcase';
import ThemeToggle from '../components/ThemeToggle';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1], delay },
  }),
};

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

  return (
    <div className="min-h-screen flex bg-canvas text-hi selection:bg-indigo-500/30 font-sans">
      
      {/* ── Left: Form Side ── */}
      <div className="w-full lg:w-[45%] flex flex-col relative z-10 shadow-2xl shadow-black/50">
        
        {/* Top Logo */}
        <div className="p-8 sm:px-12 lg:px-16 pt-12 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <img src="/favicon.svg" alt="DistractFree Logo" className="w-8 h-8 rounded-lg" />
            <span className="font-semibold text-hi text-lg tracking-tight">DistractFree</span>
          </Link>
          <ThemeToggle />
        </div>

        {/* Form Container */}
        <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-16 pb-12">
          <motion.div className="w-full max-w-[380px] mx-auto" initial="hidden" animate="visible">
            
            <motion.div variants={fadeUp} custom={0} className="mb-8">
              <h1 className="text-3xl font-semibold text-hi mb-2 tracking-tight">Create an account</h1>
              <p className="text-fg-2 text-[15px]">Start building sustainable focus habits.</p>
            </motion.div>

            <motion.form onSubmit={handleSubmit} className="space-y-4" variants={fadeUp} custom={0.1}>
              <div>
                <label className="block text-fg-2 text-sm font-medium mb-1.5 pl-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full bg-surface-2 border border-ink/[0.06] rounded-2xl px-5 py-3.5 text-hi text-[15px] placeholder-fg-3 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-sm"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-fg-2 text-sm font-medium mb-1.5 pl-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-surface-2 border border-ink/[0.06] rounded-2xl px-5 py-3.5 text-hi text-[15px] placeholder-fg-3 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-sm"
                  autoComplete="email"
                />
              </div>
              
              <div>
                <label className="block text-fg-2 text-sm font-medium mb-1.5 pl-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-2 border border-ink/[0.06] rounded-2xl px-5 py-3.5 text-hi text-[15px] placeholder-fg-3 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-sm"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="block text-fg-2 text-sm font-medium mb-1.5 pl-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-2 border border-ink/[0.06] rounded-2xl px-5 py-3.5 text-hi text-[15px] placeholder-fg-3 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-sm"
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl py-2.5">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium text-[15px] py-3.5 px-4 rounded-2xl transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 mt-4"
                style={{background:'linear-gradient(135deg, #5C6BC0, #7E8CF6)'}}
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
            </motion.form>

            <motion.div variants={fadeUp} custom={0.2} className="mt-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-ink/[0.06]" />
                <span className="text-xs text-fg-2 font-medium uppercase tracking-wider">or continue with</span>
                <div className="flex-1 h-px bg-ink/[0.06]" />
              </div>

              {/* Simplified Google Auth Container */}
              <div className="flex justify-center bg-surface-2 hover:bg-surface-3 border border-ink/[0.06] rounded-2xl p-1 transition-colors overflow-hidden">
                 <GoogleAuthButton
                  onSuccess={handleGoogleSuccess}
                  onError={(err) => setError(err?.response?.data?.message || err?.message || 'Google sign-in failed')}
                />
              </div>
            </motion.div>

          </motion.div>
        </div>

        {/* Footer */}
        <div className="p-8 sm:px-12 lg:px-16 pb-8 text-center lg:text-left">
           <p className="text-fg-2 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* ── Right: Visual Side ── */}
      <AuthShowcase />
    </div>
  );
};

export default RegisterPage;
