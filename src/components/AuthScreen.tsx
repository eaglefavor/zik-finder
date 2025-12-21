'use client';

import { useState } from 'react';
import { useAppContext } from '@/lib/context';
import { Home, Mail, Lock, User, Phone, ArrowRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { UserRole } from '@/lib/types';

export default function AuthScreen() {
  const { login, signup } = useAppContext();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'student' as UserRole
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(formData.email, formData.password);
        if (!res.success) setError(res.message);
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
            {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm animate-shake">
            <AlertCircle size={18} />
            {error}
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
              <button type="button" className="text-xs font-bold text-blue-600">Forgot Password?</button>
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
