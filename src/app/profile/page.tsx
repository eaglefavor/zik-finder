'use client';

import { useAppContext } from '@/lib/context';
import { ShieldCheck, LogOut, Settings, HelpCircle, Bell, Lock, FileText, Loader2, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const { user, role, logout } = useAppContext();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'verified'>('none');

  useEffect(() => {
    if (user) {
      checkVerificationStatus();
    }
  }, [user]);

  const checkVerificationStatus = async () => {
    if (!user) return;
    
    // First check if already verified in profile
    if (user.is_verified) {
      setVerificationStatus('verified');
      return;
    }

    // Check for pending or approved docs
    const { data } = await supabase
      .from('verification_docs')
      .select('status')
      .eq('landlord_id', user.id)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      if (data.status === 'approved') {
         setVerificationStatus('verified');
      } else {
         setVerificationStatus('pending');
      }
    } else {
      setVerificationStatus('none');
    }
  };

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/verification-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('secure-docs')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Record the document in the database for admin review
      const { error: dbError } = await supabase
        .from('verification_docs')
        .insert({
          landlord_id: user.id,
          id_card_path: filePath,
          status: 'pending'
        });

      if (dbError) {
        console.error('Error recording document in database:', dbError);
        alert('File uploaded but failed to save request: ' + dbError.message);
        return; 
      }

      setVerificationStatus('pending');
      alert('Document uploaded successfully! Our team will review it.');
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Error uploading document. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="px-4 py-6">
      <header className="flex flex-col items-center py-8">
        <div className="relative mb-4">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-3xl font-bold border-4 border-white shadow-sm">
            {(user.name || 'U')[0]}
          </div>
          {role === 'landlord' && verificationStatus === 'verified' && (
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
          <MenuButton icon={Bell} label="Notifications" onClick={() => alert('No new notifications')} />
          <MenuButton icon={Settings} label="Account Settings" onClick={() => alert('Account settings coming soon')} />
          <MenuButton icon={Lock} label="Change Password" onClick={() => alert('Change password flow coming soon')} />
          <MenuButton icon={HelpCircle} label="Help & Support" onClick={() => alert('Contacting support...')} />
        </div>

        {role === 'landlord' && (
          <div className={`p-5 rounded-3xl border transition-colors ${
            verificationStatus === 'verified'
              ? 'bg-green-50 border-green-100' 
              : verificationStatus === 'pending'
                ? 'bg-yellow-50 border-yellow-100'
                : 'bg-blue-50 border-blue-100'
          }`}>
            <div className="flex items-start gap-3">
              {verificationStatus === 'verified' ? (
                <CheckCircle className="text-green-500 shrink-0" size={24} />
              ) : verificationStatus === 'pending' ? (
                 <Loader2 className="text-yellow-600 shrink-0 animate-spin" size={24} />
              ) : (
                <ShieldCheck className="text-blue-500 shrink-0" size={24} />
              )}
              <div>
                <p className={`font-bold text-sm ${
                  verificationStatus === 'verified' ? 'text-green-800' : 
                  verificationStatus === 'pending' ? 'text-yellow-800' : 'text-blue-800'
                }`}>
                  {verificationStatus === 'verified' ? 'Account Verified' : 
                   verificationStatus === 'pending' ? 'Verification Pending' : 'Identity Verification'}
                </p>
                <p className={`text-xs ${
                  verificationStatus === 'verified' ? 'text-green-700' : 
                  verificationStatus === 'pending' ? 'text-yellow-700' : 'text-blue-700'
                }`}>
                  {verificationStatus === 'verified' 
                    ? 'Your account is verified. You have full access to all landlord features.' 
                    : verificationStatus === 'pending'
                      ? 'We are reviewing your document. This usually takes 24 hours.'
                      : 'Upload a valid ID (NIN, Drivers License, etc.) to get the verified badge.'}
                </p>
                
                {verificationStatus === 'none' && (
                  <div className="mt-4">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      className="hidden" 
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl text-xs font-bold text-blue-600 shadow-sm border border-blue-50 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="animate-spin" size={14} /> Uploading...
                        </>
                      ) : (
                        <>
                          <FileText size={14} /> Upload ID Document
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-4 text-gray-700 font-bold bg-white border border-gray-100 rounded-3xl shadow-sm active:bg-gray-50 transition-colors"
          >
            <LogOut size={20} /> Log Out
          </button>
          
          <button 
            onClick={() => confirm('Are you sure you want to delete your account? This cannot be undone.') && handleLogout()}
            className="w-full py-2 text-red-400 text-xs font-medium"
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick }: { icon: any; label: string; onClick?: () => void }) {
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