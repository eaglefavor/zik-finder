'use client';

import { useAppContext } from '@/lib/context';
import { useData } from '@/lib/data-context';
import { ShieldCheck, LogOut, Settings, HelpCircle, Bell, Lock, FileText, Loader2, CheckCircle, User, AlertCircle, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Compressor from 'compressorjs';

export default function ProfilePage() {
  const { user, role, logout } = useAppContext();
  const { lodges, deleteLodge } = useData();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'verified' | 'rejected'>('none');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<{ id: File | null; selfie: File | null }>({
    id: null,
    selfie: null
  });

  useEffect(() => {
    if (user) {
      checkVerificationStatus();
      fetchUnreadCount();

      // Subscribe to notification changes to update badge
      const channel = supabase
        .channel('profile_notifications')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for INSERT (new) and UPDATE (read status)
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    if (!user) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    
    setUnreadCount(count || 0);
  };

  const checkVerificationStatus = async () => {
    if (!user) return;
    
    // First check if already verified in profile
    if (user.is_verified) {
      setVerificationStatus('verified');
      return;
    }

    // Check for pending, approved or rejected docs
    const { data } = await supabase
      .from('verification_docs')
      .select('status, rejection_reason')
      .eq('landlord_id', user.id)
      .in('status', ['pending', 'approved', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      if (data.status === 'approved') {
         setVerificationStatus('verified');
      } else if (data.status === 'rejected') {
         setVerificationStatus('rejected');
         setRejectionReason(data.rejection_reason);
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

  const compressImage = (file: File): Promise<File> => {
    console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    return new Promise((resolve, reject) => {
      new Compressor(file, {
        quality: 0.6, // Moderate quality
        maxWidth: 1200, // Max width 1200px
        success(result) {
          const compressed = result as File;
          console.log(`Compressed size: ${(compressed.size / 1024 / 1024).toFixed(2)} MB`);
          console.log(`Reduction: ${Math.round((1 - compressed.size / file.size) * 100)}%`);
          resolve(compressed);
        },
        error(err) {
          reject(err);
        },
      });
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'id' | 'selfie') => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedFile = await compressImage(file);
        setSelectedFiles(prev => ({ ...prev, [type]: compressedFile }));
      } catch (err) {
        console.error('Compression failed:', err);
        // Fallback to original file if compression fails
        setSelectedFiles(prev => ({ ...prev, [type]: file }));
      }
    }
  };

  const handleSubmitVerification = async () => {
    if (!selectedFiles.id || !selectedFiles.selfie) return;

    setUploading(true);

    try {
      // 1. Upload ID
      const idExt = selectedFiles.id.name.split('.').pop();
      const idPath = `${user.id}/id-${Math.random().toString(36).substring(2)}.${idExt}`;
      const { error: idError } = await supabase.storage
        .from('secure-docs')
        .upload(idPath, selectedFiles.id);

      if (idError) throw idError;

      // 2. Upload Selfie
      const selfieExt = selectedFiles.selfie.name.split('.').pop();
      const selfiePath = `${user.id}/selfie-${Math.random().toString(36).substring(2)}.${selfieExt}`;
      const { error: selfieError } = await supabase.storage
        .from('secure-docs')
        .upload(selfiePath, selectedFiles.selfie);

      if (selfieError) throw selfieError;

      // 3. Record in DB
      // If re-submitting, delete old rejected entries and their files
      if (verificationStatus === 'rejected') {
         // Fetch old paths first
         const { data: oldDocs } = await supabase
           .from('verification_docs')
           .select('id_card_path, selfie_path')
           .eq('landlord_id', user.id)
           .eq('status', 'rejected');

         if (oldDocs && oldDocs.length > 0) {
           const pathsToDelete: string[] = [];
           oldDocs.forEach(doc => {
             if (doc.id_card_path) pathsToDelete.push(doc.id_card_path);
             if (doc.selfie_path) pathsToDelete.push(doc.selfie_path);
           });
           
           if (pathsToDelete.length > 0) {
             const { error: removeError } = await supabase.storage
               .from('secure-docs')
               .remove(pathsToDelete);
             
             if (removeError) console.error('Error removing old files:', removeError);
           }
         }

         // Delete the DB row
         await supabase.from('verification_docs').delete().eq('landlord_id', user.id).eq('status', 'rejected');
      }

      const { error: dbError } = await supabase
        .from('verification_docs')
        .insert({
          landlord_id: user.id,
          id_card_path: idPath,
          selfie_path: selfiePath,
          status: 'pending'
        });

      if (dbError) {
        throw dbError;
      }

      setVerificationStatus('pending');
      alert('Documents uploaded successfully! We will review your submission shortly.');
      setSelectedFiles({ id: null, selfie: null }); // Reset
    } catch (error: any) {
      console.error('Error uploading documents:', error);
      alert('Error uploading documents: ' + error.message);
    } finally {
      setUploading(false);
    }
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
    } catch (error: any) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account: ' + error.message);
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
          <MenuButton 
            icon={Bell} 
            label="Notifications" 
            onClick={() => router.push('/profile/notifications')} 
            badge={unreadCount > 0 ? unreadCount : undefined}
          />
          <MenuButton icon={Settings} label="Account Settings" onClick={() => router.push('/profile/settings')} />
          <MenuButton icon={Lock} label="Change Password" onClick={() => router.push('/profile/change-password')} />
          <MenuButton icon={HelpCircle} label="Help & Support" onClick={() => router.push('/profile/support')} />
        </div>

        {role === 'landlord' && (
          <div className={`p-5 rounded-3xl border transition-colors ${
            verificationStatus === 'verified'
              ? 'bg-green-50 border-green-100' 
              : verificationStatus === 'pending'
                ? 'bg-yellow-50 border-yellow-100'
                : verificationStatus === 'rejected'
                  ? 'bg-red-50 border-red-100'
                  : 'bg-blue-50 border-blue-100'
          }`}>
            <div className="flex items-start gap-3">
              {verificationStatus === 'verified' ? (
                <CheckCircle className="text-green-500 shrink-0" size={24} />
              ) : verificationStatus === 'pending' ? (
                 <Loader2 className="text-yellow-600 shrink-0 animate-spin" size={24} />
              ) : verificationStatus === 'rejected' ? (
                 <AlertCircle className="text-red-500 shrink-0" size={24} />
              ) : (
                <ShieldCheck className="text-blue-500 shrink-0" size={24} />
              )}
              <div className="flex-1">
                <p className={`font-bold text-sm ${
                  verificationStatus === 'verified' ? 'text-green-800' : 
                  verificationStatus === 'pending' ? 'text-yellow-800' : 
                  verificationStatus === 'rejected' ? 'text-red-800' : 'text-blue-800'
                }`}>
                  {verificationStatus === 'verified' ? 'Account Verified' : 
                   verificationStatus === 'pending' ? 'Verification Pending' : 
                   verificationStatus === 'rejected' ? 'Verification Rejected' : 'Identity Verification'}
                </p>
                <p className={`text-xs ${
                  verificationStatus === 'verified' ? 'text-green-700' : 
                  verificationStatus === 'pending' ? 'text-yellow-700' : 
                  verificationStatus === 'rejected' ? 'text-red-700' : 'text-blue-700'
                }`}>
                  {verificationStatus === 'verified' 
                    ? 'Your account is verified. You have full access to all landlord features.' 
                    : verificationStatus === 'pending'
                      ? 'We are reviewing your document. This usually takes 24 hours.'
                      : verificationStatus === 'rejected'
                        ? rejectionReason || 'Your documents were rejected. Please check the requirements and try again.'
                        : 'Upload a valid ID (NIN, Drivers License, etc.) to get the verified badge.'}
                </p>
                
                {(verificationStatus === 'none' || verificationStatus === 'rejected') && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                       <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Required Documents</p>
                       {verificationStatus === 'rejected' && (
                         <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">Resubmission Required</span>
                       )}
                    </div>
                    
                    {/* ID Card Upload */}
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                          <FileText size={16} />
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-gray-700">1. Valid ID Card</p>
                          <p className="text-gray-400">NIN, Voter's Card, or Driver's License</p>
                        </div>
                      </div>
                      <input 
                        type="file" 
                        id="id-upload"
                        className="hidden" 
                        accept=".jpg,.jpeg,.png"
                        onChange={(e) => handleFileSelect(e, 'id')}
                      />
                      <label 
                        htmlFor="id-upload"
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          selectedFiles.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {selectedFiles.id ? 'Selected' : 'Select'}
                      </label>
                    </div>

                    {/* Selfie Upload */}
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                          <User size={16} />
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-gray-700">2. Selfie with ID</p>
                          <p className="text-gray-400">Hold your ID next to your face</p>
                        </div>
                      </div>
                      <input 
                        type="file" 
                        id="selfie-upload"
                        className="hidden" 
                        accept=".jpg,.jpeg,.png"
                        onChange={(e) => handleFileSelect(e, 'selfie')}
                      />
                      <label 
                        htmlFor="selfie-upload"
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          selectedFiles.selfie ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {selectedFiles.selfie ? 'Selected' : 'Select'}
                      </label>
                    </div>

                    <button 
                      onClick={handleSubmitVerification}
                      disabled={uploading || !selectedFiles.id || !selectedFiles.selfie}
                      className="w-full flex items-center justify-center gap-2 mt-2 bg-blue-600 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="animate-spin" size={16} /> Uploading...
                        </>
                      ) : (
                        <>{verificationStatus === 'rejected' ? 'Resubmit Verification' : 'Submit for Verification'}</>
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

function MenuButton({ icon: Icon, label, onClick, badge }: { icon: any; label: string; onClick?: () => void; badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 relative">
          <Icon size={20} />
          {badge !== undefined && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">{badge > 9 ? '9+' : badge}</span>
            </div>
          )}
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