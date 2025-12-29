'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock, Loader2, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [strength, setStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);

  const checkStrength = (pass: string) => {
    if (pass.length === 0) return setStrength(null);
    if (pass.length < 6) return setStrength('weak');
    if (pass.length < 10) return setStrength('medium');
    if (/[A-Z]/.test(pass) && /[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) return setStrength('strong');
    return setStrength('medium');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }
    
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      toast.success('Password updated successfully!');
      router.back();
    } catch (err: unknown) {
      toast.error('Error updating password: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm border border-gray-100 active:scale-90 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Change Password</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-4 text-gray-400" size={18} />
              <input 
                type="password" 
                required
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  checkStrength(e.target.value);
                }}
                placeholder="Minimum 6 characters"
                className="w-full p-4 pl-12 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all"
              />
            </div>
            {/* Strength Indicator */}
            {password.length > 0 && (
              <div className="mt-2 ml-1 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className={`h-1 w-6 rounded-full ${strength === 'weak' || strength === 'medium' || strength === 'strong' ? 'bg-red-500' : 'bg-gray-200'}`} />
                  <div className={`h-1 w-6 rounded-full ${strength === 'medium' || strength === 'strong' ? 'bg-yellow-500' : 'bg-gray-200'}`} />
                  <div className={`h-1 w-6 rounded-full ${strength === 'strong' ? 'bg-green-500' : 'bg-gray-200'}`} />
                </div>
                <span className={`text-[10px] font-bold uppercase ${
                  strength === 'weak' ? 'text-red-500' : 
                  strength === 'medium' ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {strength}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-4 text-gray-400" size={18} />
              <input 
                type="password" 
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full p-4 pl-12 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading || !password || !confirmPassword}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <>
              <KeyRound size={20} /> Update Password
            </>
          )}
        </button>
      </form>
    </div>
  );
}
