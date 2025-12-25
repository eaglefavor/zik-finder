'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Phone, Loader2, Save } from 'lucide-react';
import { useAppContext } from '@/lib/context';
import { supabase } from '@/lib/supabase';

export default function AccountSettingsPage() {
  const { user, refreshProfile } = useAppContext();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone_number || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          phone_number: formData.phone
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      alert('Profile updated successfully!');
      router.back();
    } catch (err: any) {
      alert('Error updating profile: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm border border-gray-100 active:scale-90 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-4 top-4 text-gray-400" size={18} />
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full p-4 pl-12 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-4 text-gray-400" size={18} />
              <input 
                type="tel" 
                required
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full p-4 pl-12 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-2 ml-1">
              This number will be visible to students interested in your lodge.
            </p>
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading || !formData.name || !formData.phone}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <>
              <Save size={20} /> Save Changes
            </>
          )}
        </button>
      </form>
    </div>
  );
}
