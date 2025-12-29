'use client';

import { useAppContext } from '@/lib/context';
import { useData } from '@/lib/data-context';
import { ShieldCheck, LogOut, Settings, HelpCircle, Bell, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import VerificationStatusCard from '@/components/profile/VerificationStatusCard';

export default function ProfilePage() {
  const { user, role, logout } = useAppContext();
  const { lodges, deleteLodge } = useData();
  const router = useRouter();
  
  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action is permanent and cannot be undone.')) {
      return;
    }

    try {
      // 1. Clean up Cloudinary images by deleting all lodges
      const userLodges = lodges.filter(l => l.landlord_id === user.id);
      for (const lodge of userLodges) {
        await deleteLodge(lodge.id);
      }

      // 2. Clean up Supabase storage and Account (via SQL function)
      const { error } = await supabase.rpc('delete_own_user');

      if (error) throw error;

      await logout();
      router.push('/');
    } catch (error: unknown) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div className="px-4 py-6">
      <header className="flex flex-col items-center py-8">
        <div className="relative mb-4">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-3xl font-bold border-4 border-white shadow-sm overflow-hidden">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name || 'User'} className="w-full h-full object-cover" />
            ) : (
              (user.name || 'U')[0]
            )}
          </div>
          {role === 'landlord' && user.is_verified && (
            <div className="absolute bottom-0 right-0 bg-green-500 text-white p-1 rounded-full border-2 border-white">
              <ShieldCheck size={16} />
            </div>
          )}
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{user.name || 'User'}</h2>
        <p className="text-gray-500 capitalize">{role}</p>
      </header>

      <div className="space-y-4">
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <MenuButton icon={Bell} label="Notifications" onClick={() => router.push('/profile/notifications')} />
          <MenuButton icon={Settings} label="Account Settings" onClick={() => router.push('/profile/settings')} />
          <MenuButton icon={Lock} label="Change Password" onClick={() => router.push('/profile/change-password')} />
          <MenuButton icon={HelpCircle} label="Help & Support" onClick={() => router.push('/profile/support')} />
        </div>

        {role === 'landlord' && (
          <VerificationStatusCard user={user} />
        )}

        <div className="space-y-2">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-4 text-gray-700 font-bold bg-white border border-gray-100 rounded-3xl shadow-sm active:bg-gray-50 transition-colors"
          >
            <LogOut size={20} /> Log Out
          </button>
          
          <button 
            onClick={handleDeleteAccount}
            className="w-full py-2 text-red-400 text-xs font-medium"
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
          <Icon size={20} />
        </div>
        <span className="font-bold text-gray-700">{label}</span>
      </div>
      <div className="text-gray-300">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  );
}