'use client';

import { useAppContext } from '@/lib/context';
import { useData } from '@/lib/data-context';
import { ShieldCheck, LogOut, Settings, HelpCircle, Bell, Lock, ChevronRight, User as UserIcon, Mail, Phone, ChevronLeft, Sparkles, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import VerificationStatusCard from '@/components/profile/VerificationStatusCard';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfilePage() {
  const { user, role, logout } = useAppContext();
  const { lodges, deleteLodge, unreadCount } = useData();
  const router = useRouter();
  
  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const executeDeleteAccount = async () => {
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
      toast.success('Account deleted successfully');
      router.push('/');
    } catch (error: unknown) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDeleteAccount = () => {
    toast.error('Delete account?', {
      description: 'This action is permanent and cannot be undone.',
      action: {
        label: 'Delete Anyway',
        onClick: executeDeleteAccount
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-32">
      {/* Premium Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 py-5 shadow-sm shadow-gray-100/50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.back()} 
              className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all active:scale-90"
            >
              <ChevronLeft size={22} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none">Account</h1>
              <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-1">Profile & Preferences</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Sparkles size={16} className="text-blue-600" />
             </div>
          </div>
        </div>
      </header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto px-4 py-8 space-y-8"
      >
        {/* Profile Header Card */}
        <section className="bg-white p-6 xs:p-8 rounded-[32px] xs:rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="w-28 h-28 xs:w-32 xs:h-32 bg-gradient-to-br from-blue-50 to-blue-100 rounded-[40px] flex items-center justify-center text-blue-600 text-4xl font-black border-4 border-white shadow-xl overflow-hidden ring-1 ring-blue-50">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name || 'User'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                  (user.name || 'U')[0]
                )}
              </div>
              {role === 'landlord' && user.is_verified && (
                <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-2 rounded-2xl border-4 border-white shadow-lg">
                  <ShieldCheck size={20} />
                </div>
              )}
            </div>
            
            <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-1">{user.name || 'User'}</h2>
            <div className="flex items-center gap-2 mb-6">
               <span className="text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100">
                 {role} Account
               </span>
            </div>

            <div className="grid grid-cols-1 w-full gap-2 border-t border-gray-50 pt-6">
               <div className="flex items-center justify-center gap-2 text-gray-400">
                  <Mail size={14} />
                  <span className="text-xs font-bold truncate max-w-[200px]">{user.email}</span>
               </div>
               {user.phone_number && (
                 <div className="flex items-center justify-center gap-2 text-gray-400">
                    <Phone size={14} />
                    <span className="text-xs font-bold">{user.phone_number}</span>
                 </div>
               )}
            </div>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-700 pointer-events-none">
             <UserIcon size={120} strokeWidth={3} />
          </div>
        </section>

        {/* Verification Card for Landlords */}
        {role === 'landlord' && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <VerificationStatusCard user={user} />
          </motion.div>
        )}

        {/* Menu Section */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-6 mb-4">Settings & Privacy</h3>
          <div className="bg-white rounded-[32px] xs:rounded-[40px] border border-gray-100 overflow-hidden shadow-sm">
            <MenuButton 
              icon={Bell} 
              label="Notifications" 
              onClick={() => router.push('/profile/notifications')} 
              showDot={unreadCount > 0}
              color="text-orange-500"
              bgColor="bg-orange-50"
            />
            <MenuButton 
              icon={Settings} 
              label="Account Settings" 
              onClick={() => router.push('/profile/settings')}
              color="text-blue-600"
              bgColor="bg-blue-50"
            />
            <MenuButton 
              icon={Lock} 
              label="Change Password" 
              onClick={() => router.push('/profile/change-password')}
              color="text-purple-600"
              bgColor="bg-purple-50"
            />
            <MenuButton 
              icon={HelpCircle} 
              label="Help & Support" 
              onClick={() => router.push('/profile/support')}
              color="text-green-600"
              bgColor="bg-green-50"
            />
          </div>
        </section>

        {/* Danger Zone / Session */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-3 py-5 bg-white border border-gray-100 text-gray-700 font-black text-xs uppercase tracking-widest rounded-[24px] xs:rounded-[32px] shadow-sm active:scale-95 transition-all hover:bg-gray-50"
            >
              <LogOut size={18} className="text-gray-400" /> Log Out Session
            </button>
            
            <button 
              onClick={handleDeleteAccount}
              className="w-full flex items-center justify-center gap-2 py-4 text-red-400/60 hover:text-red-500 font-bold text-[10px] uppercase tracking-widest transition-colors"
            >
              <Trash2 size={12} /> Delete My Account
            </button>
          </div>
        </section>

        <p className="text-center text-[10px] text-gray-300 font-black uppercase tracking-widest">
          ZikLodge v1.2.4 • Made with ❤️ in Awka
        </p>
      </motion.div>
    </div>
  );
}

interface MenuButtonProps {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  showDot?: boolean;
  color?: string;
  bgColor?: string;
}

function MenuButton({ icon: Icon, label, onClick, showDot, color = "text-gray-400", bgColor = "bg-gray-50" }: MenuButtonProps) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between p-6 xs:p-7 hover:bg-gray-50 transition-all border-b border-gray-50 last:border-0 group active:bg-blue-50/30"
    >
      <div className="flex items-center gap-5">
        <div className={`w-12 h-12 ${bgColor} rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-active:scale-90 relative`}>
          <Icon size={22} className={color} />
          {showDot && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          )}
        </div>
        <span className="font-black text-gray-700 text-sm tracking-tight">{label}</span>
      </div>
      <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300 group-hover:text-blue-500 group-hover:bg-blue-50 transition-all">
        <ChevronRight size={18} />
      </div>
    </button>
  );
}