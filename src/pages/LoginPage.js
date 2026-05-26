import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { FiClock, FiShield, FiTrendingUp, FiCheckCircle } from 'react-icons/fi';

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
            <img src="/favicon.svg" alt="DistractFree Logo" className="w-8 h-8 rounded-lg" />
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
                  onError={(err) => setError(err?.response?.data?.message || err?.message || 'Google sign-in failed')}
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
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden items-center justify-center bg-[#05050A] border-l border-white/[0.04]">
        
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
           {/* Glows */}
           <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full opacity-[0.08] blur-[100px]" style={{background:'radial-gradient(circle, #6366F1, transparent 70%)'}} />
           <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full opacity-[0.06] blur-[120px]" style={{background:'radial-gradient(circle, #8B5CF6, transparent 70%)'}} />
           <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full opacity-[0.04] blur-[80px]" style={{background:'radial-gradient(circle, #3FAE6A, transparent 70%)'}} />
           
           {/* Grid Pattern */}
           <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-60" />
           
           {/* Noise overlay */}
           <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")'}} />
        </div>

        {/* UI Mockup Composition */}
        <div className="relative z-10 w-full max-w-[640px] h-[640px] flex items-center justify-center">
          
          {/* Main Dashboard Card */}
          <motion.div 
            className="absolute z-20 w-[500px] rounded-[24px] bg-[#14171C]/90 backdrop-blur-2xl border border-white/[0.08] shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04] bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57] shadow-[0_0_10px_rgba(255,95,87,0.4)]" />
                <div className="w-3 h-3 rounded-full bg-[#FEBC2E] shadow-[0_0_10px_rgba(254,188,46,0.4)]" />
                <div className="w-3 h-3 rounded-full bg-[#28C840] shadow-[0_0_10px_rgba(40,200,64,0.4)]" />
              </div>
              <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">DistractFree Dashboard</div>
            </div>
            
            <div className="p-7">
               <div className="flex items-center justify-between mb-8">
                 <div>
                   <h3 className="text-white font-semibold text-xl mb-1">Weekly Overview</h3>
                   <p className="text-gray-400 text-sm">Your focus stats for the last 7 days</p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                   <FiTrendingUp className="text-white text-lg" />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-5 mb-8">
                 <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-5 relative overflow-hidden group hover:bg-white/[0.04] transition-colors">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4">
                      <FiClock className="text-indigo-400 text-xl" />
                    </div>
                    <div className="text-3xl font-bold text-white mb-1 tracking-tight">32h <span className="text-xl text-gray-400 font-medium">14m</span></div>
                    <div className="text-sm text-gray-500 font-medium">Deep Work Time</div>
                 </div>
                 <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-5 relative overflow-hidden group hover:bg-white/[0.04] transition-colors">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                      <FiShield className="text-emerald-400 text-xl" />
                    </div>
                    <div className="text-3xl font-bold text-white mb-1 tracking-tight">85%</div>
                    <div className="text-sm text-gray-500 font-medium">Avg Focus Score</div>
                 </div>
               </div>
               
               <div className="w-full rounded-2xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.05] p-5">
                 <h4 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-5 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-indigo-500" /> Recent Sessions
                 </h4>
                 <div className="space-y-4">
                   <div className="flex items-center justify-between group">
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                         <FiCheckCircle className="text-indigo-400 text-lg" />
                       </div>
                       <div>
                         <div className="text-sm text-white font-medium mb-0.5">Deep Work: Coding</div>
                         <div className="text-xs text-gray-500">Completed 45m</div>
                       </div>
                     </div>
                     <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20 flex items-center gap-1">
                       <span>🪙</span> +150
                     </span>
                   </div>
                   <div className="flex items-center justify-between group">
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                         <FiCheckCircle className="text-emerald-400 text-lg" />
                       </div>
                       <div>
                         <div className="text-sm text-white font-medium mb-0.5">Reading Documentation</div>
                         <div className="text-xs text-gray-500">Completed 30m</div>
                       </div>
                     </div>
                     <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20 flex items-center gap-1">
                       <span>🪙</span> +100
                     </span>
                   </div>
                 </div>
               </div>
            </div>
          </motion.div>

          {/* Floating Element 1 - Timer */}
          <motion.div 
            className="absolute z-30 top-[3%] right-[2%] w-56 rounded-2xl bg-[#1A1D24]/95 backdrop-blur-2xl border border-white/[0.1] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.5)] scale-[0.85]"
            initial={{ opacity: 0, x: 40, rotate: 5 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 100, delay: 0.5 }}
          >
             <div className="flex items-center justify-between mb-4">
               <div className="text-sm font-semibold text-white flex items-center gap-2">
                 <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)] animate-pulse" />
                 Active Focus
               </div>
               <div className="text-indigo-400 font-mono font-bold text-lg">24:59</div>
             </div>
             <div className="w-full h-2 rounded-full bg-white/[0.05] overflow-hidden p-0.5">
               <motion.div 
                 className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                 initial={{ width: "100%" }}
                 animate={{ width: "0%" }}
                 transition={{ duration: 1500, ease: "linear" }}
               />
             </div>
          </motion.div>

          {/* Floating Element 2 - Notification */}
          <motion.div 
            className="absolute z-30 bottom-[5%] left-[2%] w-64 rounded-2xl bg-[#1A1D24]/95 backdrop-blur-2xl border border-white/[0.1] p-3.5 shadow-[0_20px_40px_rgba(0,0,0,0.5)] scale-[0.85]"
            initial={{ opacity: 0, x: -40, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 100, delay: 0.7 }}
          >
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/20 flex items-center justify-center border border-amber-500/30 text-2xl shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                🔥
              </div>
              <div>
                <div className="text-sm text-white font-bold mb-0.5">7-Day Streak!</div>
                <div className="text-xs text-gray-400 leading-relaxed">You're on fire. Keep your focus streak alive to earn a 1.5x coin multiplier.</div>
              </div>
            </div>
          </motion.div>

          {/* Decorative Orbs */}
          <motion.div
            className="absolute z-10 top-[30%] right-[10%] w-16 h-16 rounded-full bg-indigo-500/20 blur-xl mix-blend-screen"
            animate={{ y: [-10, 10, -10], scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute z-10 bottom-[30%] left-[10%] w-20 h-20 rounded-full bg-emerald-500/20 blur-xl mix-blend-screen"
            animate={{ y: [10, -10, 10], scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
