'use client';

import { useState, useEffect } from 'react';
import { useAppContext } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, User, Phone, ArrowRight, Loader2, AlertCircle, CheckCircle, RefreshCw, MessageCircle, Sparkles, Building2, GraduationCap } from 'lucide-react';
import { UserRole } from '@/lib/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuthScreen() {
  const { login, signup } = useAppContext();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Self-healing: Check if we actually have a session but are stuck on AuthScreen
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        window.location.reload();
      }
    };
    checkSession();
  }, []);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'student' as UserRole
  });

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      toast.error('Error connecting to Google: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    setError('');
    setSuccessMessage('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: formData.email,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        }
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccessMessage(`Verification email resent to ${formData.email}. Please check your inbox and spam folder.`);
      }
    } catch (err) {
      setError('Failed to resend email.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(formData.email, formData.password);
        if (!res.success) {
          setError(res.message);
        }
      } else {
        // Validation
        if (!formData.name || !formData.email || !formData.password || !formData.phone) {
          setError('All fields are required');
          setLoading(false);
          return;
        }
        const res = await signup({
          email: formData.email,
          name: formData.name,
          phone: formData.phone,
          role: formData.role
        }, formData.password);
        
        if (!res.success) {
          setError(res.message);
        } else {
          setSuccessMessage(`Account created! A verification email has been sent to ${formData.email}. Please verify your email to log in.`);
          setMode('login'); // Switch to login mode
          setFormData(prev => ({ ...prev, password: '' })); // Clear password
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-[28px] shadow-2xl shadow-blue-200 mb-6 text-white"
            >
               <Sparkles size={32} fill="currentColor" className="text-blue-100" />
            </motion.div>
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-3xl font-black text-gray-900 tracking-tight"
            >
              ZikLodge
            </motion.h1>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-2"
            >
              Your Campus Housing Companion
            </motion.p>
          </div>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white p-6 xs:p-8 rounded-[40px] shadow-xl shadow-gray-200/50 border border-gray-100"
          >
            {/* Google Login Button */}
            <div className="relative mb-8">
              <button 
                onClick={handleGoogleLogin}
                className="w-full py-4 bg-white border border-gray-100 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-all hover:bg-gray-50 hover:border-gray-200 shadow-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                </svg>
                Continue with Google
              </button>
              <div className="absolute -top-3 right-4 bg-green-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow-sm border-2 border-white transform rotate-2">
                Fastest
              </div>
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="h-px bg-gray-100 flex-1" />
              <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Or continue with email</span>
              <div className="h-px bg-gray-100 flex-1" />
            </div>

            {/* Mode Switcher */}
            <div className="bg-gray-50 p-1.5 rounded-2xl mb-8 flex relative">
              <button 
                onClick={() => { setMode('login'); setError(''); setSuccessMessage(''); }}
                className={`flex-1 relative z-10 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${mode === 'login' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Sign In
              </button>
              <button 
                onClick={() => { setMode('signup'); setError(''); setSuccessMessage(''); }}
                className={`flex-1 relative z-10 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${mode === 'signup' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Register
              </button>
              
              {/* Animated Tab Indicator */}
              <motion.div 
                layoutId="auth-tab"
                className="absolute top-1.5 bottom-1.5 bg-white rounded-xl shadow-sm border border-gray-200/50"
                initial={false}
                animate={{ 
                  left: mode === 'login' ? '6px' : '50%', 
                  width: 'calc(50% - 9px)',
                  x: mode === 'signup' ? 3 : 0
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            </div>

            <AnimatePresence mode="wait">
              {successMessage ? (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-start gap-3 text-green-700 text-sm"
                >
                  <CheckCircle className="shrink-0 mt-0.5 text-green-500" size={18} />
                  <div>
                    <p className="font-medium">{successMessage}</p>
                  </div>
                </motion.div>
              ) : null}

              {error ? (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-2 text-red-600 text-sm"
                >
                  <div className="flex items-center gap-3 font-medium">
                    <AlertCircle size={18} className="shrink-0" />
                    {error}
                  </div>
                  {error.toLowerCase().includes('email not confirmed') && (
                    <button 
                      onClick={handleResendVerification}
                      disabled={resending}
                      className="mt-2 flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-red-100 text-red-600 rounded-xl text-xs font-bold transition-colors hover:bg-red-50"
                    >
                      {resending ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                      Resend Verification Email
                    </button>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="popLayout">
                {mode === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    {/* Role Selector */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div 
                        onClick={() => setFormData({...formData, role: 'student'})}
                        className={`cursor-pointer p-3 rounded-2xl border-2 transition-all duration-200 ${
                          formData.role === 'student' 
                            ? 'bg-blue-50/50 border-blue-500 text-blue-700 ring-2 ring-blue-500/10' 
                            : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <GraduationCap className={`mb-2 ${formData.role === 'student' ? 'text-blue-500' : 'text-gray-400'}`} size={24} />
                        <div className="text-xs font-black uppercase tracking-widest">Student</div>
                      </div>
                      <div 
                        onClick={() => setFormData({...formData, role: 'landlord'})}
                        className={`cursor-pointer p-3 rounded-2xl border-2 transition-all duration-200 ${
                          formData.role === 'landlord' 
                            ? 'bg-green-50/50 border-green-500 text-green-700 ring-2 ring-green-500/10' 
                            : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Building2 className={`mb-2 ${formData.role === 'landlord' ? 'text-green-500' : 'text-gray-400'}`} size={24} />
                        <div className="text-xs font-black uppercase tracking-widest">Landlord</div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3">
                        <MessageCircle className="text-blue-600 shrink-0 mt-0.5" size={16} />
                        <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
                          <span className="font-bold block text-blue-900 mb-0.5 uppercase tracking-wide text-[10px]">WhatsApp Required</span>
                          Please use a number that is active on WhatsApp so landlords can contact you effortlessly.
                        </p>
                    </div>

                    <div className="relative group">
                      <User className="absolute left-4 top-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                      <input 
                        type="text" 
                        placeholder="Full Name"
                        required
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full p-4 pl-12 bg-gray-50 border border-gray-100 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 rounded-2xl outline-none transition-all font-medium text-gray-900 placeholder-gray-400"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative group">
                <Mail className="absolute left-4 top-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="email" 
                  placeholder="Email Address"
                  required
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full p-4 pl-12 bg-gray-50 border border-gray-100 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 rounded-2xl outline-none transition-all font-medium text-gray-900 placeholder-gray-400"
                />
              </div>

              <AnimatePresence mode="popLayout">
                {mode === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="relative group pt-4">
                      <Phone className="absolute left-4 top-8 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                      <input 
                        type="tel" 
                        placeholder="Phone Number (e.g. 080...)"
                        required
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        className="w-full p-4 pl-12 bg-gray-50 border border-gray-100 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 rounded-2xl outline-none transition-all font-medium text-gray-900 placeholder-gray-400"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative group">
                <Lock className="absolute left-4 top-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="password" 
                  placeholder="Password"
                  required
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full p-4 pl-12 bg-gray-50 border border-gray-100 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 rounded-2xl outline-none transition-all font-medium text-gray-900 placeholder-gray-400"
                />
              </div>

              {mode === 'login' && (
                <div className="text-right">
                  <a href="/forgot-password" className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors">Forgot Password?</a>
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-bold shadow-xl shadow-blue-200 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100 mt-6"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </motion.div>

          <div className="mt-8 text-center space-y-4">
            <p className="text-gray-400 text-xs leading-relaxed">
              By continuing, you agree to our <br />
              <span className="text-gray-900 font-bold cursor-pointer hover:underline">Terms of Service</span> and <span className="text-gray-900 font-bold cursor-pointer hover:underline">Privacy Policy</span>
            </p>
          </div>
        </div>
    </div>
  );
}