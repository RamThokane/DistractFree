import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1], delay },
  }),
};

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
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0F1115] text-white selection:bg-indigo-500/30 font-sans">
      
      {/* ── Left: Form Side ── */}
      <div className="w-full lg:w-[45%] flex flex-col relative z-10 shadow-2xl shadow-black/50">
        
        {/* Top Logo */}
        <div className="p-8 sm:px-12 lg:px-16 pt-12">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:'linear-gradient(135deg, #5C6BC0, #7E8CF6)'}}>
              <span className="text-white font-bold text-xs">D</span>
            </div>
            <span className="font-semibold text-white text-lg tracking-tight">DistractFree</span>
          </Link>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-16 pb-20">
          <motion.div className="w-full max-w-[380px] mx-auto" initial="hidden" animate="visible">
            
            <motion.div variants={fadeUp} custom={0} className="mb-8">
              <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight">Welcome back</h1>
              <p className="text-gray-400 text-[15px]">Sign in to continue your focus journey.</p>
            </motion.div>

            <motion.form onSubmit={handleSubmit} className="space-y-5" variants={fadeUp} custom={0.1}>
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2 pl-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#14171C] border border-white/[0.06] rounded-2xl px-5 py-3.5 text-white text-[15px] placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-sm"
                  autoComplete="email"
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2 pl-1 pr-1">
                  <label className="block text-gray-400 text-sm font-medium">Password</label>
                  <a href="#forgot" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                    Forgot?
                  </a>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#14171C] border border-white/[0.06] rounded-2xl px-5 py-3.5 text-white text-[15px] placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-sm"
                  autoComplete="current-password"
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
                className="w-full text-white font-medium text-[15px] py-3.5 px-4 rounded-2xl transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 mt-2"
                style={{background:'linear-gradient(135deg, #5C6BC0, #7E8CF6)'}}
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
            </motion.form>

            <motion.div variants={fadeUp} custom={0.2} className="mt-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">or continue with</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {/* Simplified Google Auth Container */}
              <div className="flex justify-center bg-[#14171C] hover:bg-[#1A1D24] border border-white/[0.06] rounded-2xl p-1 transition-colors overflow-hidden">
                 <GoogleAuthButton
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign-in failed')}
                />
              </div>
            </motion.div>

          </motion.div>
        </div>

        {/* Footer */}
        <div className="p-8 sm:px-12 lg:px-16 pb-8 text-center lg:text-left">
           <p className="text-gray-400 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Create account
            </Link>
          </p>
        </div>
      </div>

      {/* ── Right: Visual Side ── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden items-center justify-center bg-[#0A0C10] border-l border-white/[0.04]">
        
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
           <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-[0.06] blur-[120px]" style={{background:'radial-gradient(circle, #5C6BC0, transparent 70%)'}} />
           <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full opacity-[0.05] blur-[120px]" style={{background:'radial-gradient(circle, #8B5CF6, transparent 70%)'}} />
           {/* Grid */}
           <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50" />
        </div>

        {/* UI Mockup Composition */}
        <div className="relative z-10 w-full max-w-[600px] h-[600px] flex items-center justify-center">
          
          {/* Main Dashboard Card */}
          <motion.div 
            className="absolute z-20 w-[480px] rounded-2xl bg-[#14171C]/80 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/50 overflow-hidden"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]/80" />
            </div>
            <div className="p-6">
               <div className="w-32 h-4 rounded-md bg-white/[0.06] mb-6" />
               <div className="flex gap-4 mb-6">
                 <div className="flex-1 h-24 rounded-xl bg-indigo-500/[0.08] border border-indigo-500/20 p-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 mb-3" />
                    <div className="w-16 h-3 rounded bg-indigo-500/40" />
                 </div>
                 <div className="flex-1 h-24 rounded-xl bg-white/[0.03] border border-white/[0.04] p-4">
                    <div className="w-8 h-8 rounded-full bg-white/[0.06] mb-3" />
                    <div className="w-16 h-3 rounded bg-white/[0.1]" />
                 </div>
               </div>
               <div className="w-full h-32 rounded-xl bg-white/[0.03] border border-white/[0.04]" />
            </div>
          </motion.div>

          {/* Floating Element 1 - Timer */}
          <motion.div 
            className="absolute z-30 top-[15%] right-[5%] w-48 rounded-xl bg-[#1A1D24]/90 backdrop-blur-xl border border-white/[0.08] p-4 shadow-xl shadow-black/40"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
            style={{ y: -10 }}
          >
             <div className="flex items-center justify-between mb-3">
               <div className="w-12 h-3 rounded bg-white/[0.1]" />
               <div className="w-4 h-4 rounded-full bg-indigo-500/80 shadow-[0_0_10px_rgba(92,107,192,0.5)]" />
             </div>
             <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
               <div className="w-2/3 h-full bg-indigo-500/80 rounded-full" />
             </div>
          </motion.div>

          {/* Floating Element 2 - Notification */}
          <motion.div 
            className="absolute z-30 bottom-[20%] left-[5%] w-56 rounded-xl bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] p-4 shadow-xl shadow-black/40"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.7 }}
          >
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 text-lg">
                &#x1FA99;
              </div>
              <div>
                <div className="w-20 h-3 rounded bg-white/[0.2] mb-2" />
                <div className="w-12 h-2 rounded bg-indigo-400/60" />
              </div>
            </div>
          </motion.div>
          
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
