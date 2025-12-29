'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { User, Phone, Loader2, MessageCircle } from 'lucide-react';
import { UserRole } from '@/lib/types';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const { user, role: currentRole } = useAppContext();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: '',
    role: 'student' as UserRole
  });

  // If user is already fully set up (has phone and name), redirect home
  if (user && user.phone_number && user.name) {
    router.replace('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          phone_number: formData.phone,
          role: formData.role
        })
        .eq('id', user.id);

      if (error) throw error;

      // Force a reload or re-fetch of the user context would be ideal,
      // but a simple reload ensures the context gets the fresh data.
      window.location.href = '/';
      
    } catch (err: unknown) {
      toast.error('Error updating profile: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
            <User size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Complete Profile</h1>
          <p className="text-gray-500 mt-2 text-sm max-w-[250px]">
            Please complete your profile to start using ZikLodge.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!user?.name && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-4 top-4 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Enter your full name"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-4 pl-12 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            
            <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 flex gap-3 mb-3">
              <MessageCircle className="text-blue-600 shrink-0" size={18} />
              <p className="text-[11px] text-blue-700 leading-tight">
                <span className="font-bold block mb-0.5">WhatsApp Required</span>
                Please use a number that is active on WhatsApp. This is how you will be reached regarding your lodge requests.
              </p>
            </div>

            <div className="relative">
              <Phone className="absolute left-4 top-4 text-gray-400" size={18} />
              <input 
                type="tel" 
                placeholder="e.g. 08012345678"
                required
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full p-4 pl-12 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1 ml-2">
              Used for WhatsApp communication (&quot;I have a lodge for you&quot;).
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">
              I am a... <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setFormData({...formData, role: 'student'})}
                className={`flex-1 py-4 rounded-2xl text-sm font-bold border transition-all ${
                  formData.role === 'student' 
                    ? 'bg-blue-50 border-blue-200 text-blue-600 ring-1 ring-blue-200' 
                    : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                }`}
              >
                Student
              </button>
              <button 
                type="button"
                onClick={() => setFormData({...formData, role: 'landlord'})}
                className={`flex-1 py-4 rounded-2xl text-sm font-bold border transition-all ${
                  formData.role === 'landlord' 
                    ? 'bg-green-50 border-green-200 text-green-600 ring-1 ring-green-200' 
                    : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
                }`}
              >
                Landlord
              </button>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading || !formData.phone || !!(user && !user.name && !formData.name)}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100 mt-8"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              'Complete Setup'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
