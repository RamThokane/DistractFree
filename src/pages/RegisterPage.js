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
        <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-16 pb-12">
          <motion.div className="w-full max-w-[380px] mx-auto" initial="hidden" animate="visible">
            
            <motion.div variants={fadeUp} custom={0} className="mb-8">
              <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight">Create an account</h1>
              <p className="text-gray-400 text-[15px]">Start building sustainable focus habits.</p>
            </motion.div>

            <motion.form onSubmit={handleSubmit} className="space-y-4" variants={fadeUp} custom={0.1}>
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-1.5 pl-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full bg-[#14171C] border border-white/[0.06] rounded-2xl px-5 py-3.5 text-white text-[15px] placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-sm"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm font-medium mb-1.5 pl-1">Email</label>
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
                <label className="block text-gray-400 text-sm font-medium mb-1.5 pl-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#14171C] border border-white/[0.06] rounded-2xl px-5 py-3.5 text-white text-[15px] placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-sm"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm font-medium mb-1.5 pl-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#14171C] border border-white/[0.06] rounded-2xl px-5 py-3.5 text-white text-[15px] placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-sm"
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
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* ── Right: Visual Side ── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden items-center justify-center bg-[#0A0C10] border-l border-white/[0.04]">
        
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
           <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-[0.05] blur-[120px]" style={{background:'radial-gradient(circle, #5C6BC0, transparent 70%)'}} />
           <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full opacity-[0.06] blur-[120px]" style={{background:'radial-gradient(circle, #8B5CF6, transparent 70%)'}} />
           {/* Grid */}
           <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50" />
        </div>

        {/* UI Mockup Composition */}
        <div className="relative z-10 w-full max-w-[600px] h-[600px] flex items-center justify-center">
          
          {/* Main Analytics Card */}
          <motion.div 
            className="absolute z-20 w-[440px] rounded-2xl bg-[#14171C]/80 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/50 overflow-hidden"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          >
            <div className="p-6">
               <div className="flex justify-between items-center mb-8">
                 <div>
                   <div className="w-24 h-3 rounded bg-white/[0.2] mb-2" />
                   <div className="w-16 h-2 rounded bg-white/[0.06]" />
                 </div>
                 <div className="w-10 h-10 rounded-full border-2 border-indigo-500/50 border-t-indigo-500 rotate-45" />
               </div>
               
               <div className="flex items-end gap-3 h-32 mb-4">
                 {[40, 70, 45, 90, 60, 80, 50].map((h, i) => (
                   <div key={i} className="flex-1 bg-white/[0.03] rounded-t-md relative overflow-hidden group">
                      <div 
                        className="absolute bottom-0 w-full rounded-t-md transition-all duration-300 group-hover:opacity-80" 
                        style={{ height: `${h}%`, background: i === 3 ? 'linear-gradient(180deg, #7E8CF6, #5C6BC0)' : 'rgba(255,255,255,0.1)' }} 
                      />
                   </div>
                 ))}
               </div>
            </div>
          </motion.div>

          {/* Floating Element 1 - Focus Goal */}
          <motion.div 
            className="absolute z-30 top-[18%] left-[5%] w-48 rounded-xl bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] p-4 shadow-xl shadow-black/40"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
          >
             <div className="flex gap-3 items-center mb-3">
               <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                 <div className="w-3 h-3 rounded-full bg-indigo-400" />
               </div>
               <div className="w-20 h-3 rounded bg-white/[0.15]" />
             </div>
             <div className="w-16 h-5 rounded bg-white/[0.3]" />
          </motion.div>

          {/* Floating Element 2 - User Avatar Group */}
          <motion.div 
            className="absolute z-30 bottom-[25%] right-[2%] bg-[#1A1D24]/90 backdrop-blur-xl border border-white/[0.08] p-3 pr-4 rounded-full shadow-xl shadow-black/40 flex items-center gap-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.7 }}
          >
             <div className="flex -space-x-2">
               <div className="w-8 h-8 rounded-full border-2 border-[#1A1D24] bg-indigo-400 flex items-center justify-center text-[10px] font-bold text-white">A</div>
               <div className="w-8 h-8 rounded-full border-2 border-[#1A1D24] bg-purple-400 flex items-center justify-center text-[10px] font-bold text-white">B</div>
               <div className="w-8 h-8 rounded-full border-2 border-[#1A1D24] bg-gray-600 flex items-center justify-center text-[10px] font-bold text-white">+</div>
             </div>
             <div className="w-12 h-2 rounded bg-white/[0.2]" />
          </motion.div>
          
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
