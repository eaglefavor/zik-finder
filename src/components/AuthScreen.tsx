'use client';

import { useState } from 'react';
import { useAppContext } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { Home, Mail, Lock, User, Phone, ArrowRight, Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { UserRole } from '@/lib/types';

export default function AuthScreen() {
  const { login, signup } = useAppContext();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
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
    } catch (err: any) {
      alert('Error connecting to Google: ' + err.message);
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
        // Rate limit error often comes here
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
    <div className="min-h-screen bg-gray-50 flex flex-col px-6 py-12">
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-blue-100">
          <Home className="text-white" size={32} />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Zik-Lodge Finder</h1>
        <p className="text-gray-500 text-sm mt-1">
          {mode === 'login' ? 'Welcome back, sign in to continue' : 'Join the UNIZIK lodge community'}
        </p>
      </div>

      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
        <button 
          onClick={handleGoogleLogin}
          className="w-full py-4 mb-6 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-all hover:bg-gray-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="h-px bg-gray-100 flex-1" />
          <span className="text-xs text-gray-400 font-medium uppercase">Or with email</span>
          <div className="h-px bg-gray-100 flex-1" />
        </div>

        <div className="flex p-1 bg-gray-50 rounded-2xl mb-8">
          <button 
            onClick={() => { setMode('login'); setError(''); setSuccessMessage(''); }}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
              mode === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'
            }`}
          >
            Log In
          </button>
          <button 
            onClick={() => { setMode('signup'); setError(''); setSuccessMessage(''); }}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
              mode === 'signup' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'
            }`}
          >
            Sign Up
          </button>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-start gap-3 text-green-700 text-sm">
            <CheckCircle className="shrink-0 mt-0.5" size={18} />
            <div>
              <p>{successMessage}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-2 text-red-600 text-sm animate-shake">
            <div className="flex items-center gap-3">
              <AlertCircle size={18} />
              {error}
            </div>
            {error.toLowerCase().includes('email not confirmed') && (
              <button 
                onClick={handleResendVerification}
                disabled={resending}
                className="mt-2 flex items-center justify-center gap-2 w-full py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold transition-colors"
              >
                {resending ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                Resend Verification Email
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <div className="relative">
                <User className="absolute left-4 top-4 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Full Name"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-4 pl-12 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all"
                />
              </div>

              <div className="flex gap-2 mb-2">
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, role: 'student'})}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all ${
                    formData.role === 'student' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-100 text-gray-400'
                  }`}
                >
                  Student
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, role: 'landlord'})}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all ${
                    formData.role === 'landlord' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-gray-100 text-gray-400'
                  }`}
                >
                  Landlord
                </button>
              </div>
            </>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-4 text-gray-400" size={18} />
            <input 
              type="email" 
              placeholder="Email Address"
              required
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="w-full p-4 pl-12 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all"
            />
          </div>

          {mode === 'signup' && (
            <div className="relative">
              <Phone className="absolute left-4 top-4 text-gray-400" size={18} />
              <input 
                type="tel" 
                placeholder="Phone Number (e.g. 080...)"
                required
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full p-4 pl-12 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all"
              />
            </div>
          )}

          <div className="relative">
            <Lock className="absolute left-4 top-4 text-gray-400" size={18} />
            <input 
              type="password" 
              placeholder="Password"
              required
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              className="w-full p-4 pl-12 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all"
            />
          </div>

          {mode === 'login' && (
            <div className="text-right">
              <a href="/forgot-password" className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">Forgot Password?</a>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100"
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
      </div>

      <div className="mt-auto text-center">
        <p className="text-gray-400 text-xs">
          By continuing, you agree to our <br />
          <span className="text-gray-600 font-bold">Terms of Service</span> and <span className="text-gray-600 font-bold">Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}
