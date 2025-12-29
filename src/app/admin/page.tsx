'use client';

import { useAppContext } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';

interface VerificationDoc {
  id: string;
  landlord_id: string;
  id_card_path: string;
  selfie_path?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
  profiles: {
    name: string;
  };
}

export default function AdminPage() {
  const { user, role, isLoading: authLoading } = useAppContext();
  const router = useRouter();
  const [docs, setDocs] = useState<VerificationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [usage, setUsage] = useState<{ cloudinary: { used: number, limit: number }, supabase: { used: number, limit: number } } | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user || role !== 'admin') {
        router.push('/');
        return;
      }
      fetchPendingDocs();
      fetchUsage();
    }
  }, [user, role, authLoading, router]);

  const fetchUsage = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch('/api/admin/usage', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        setUsage(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch usage stats', err);
    }
  };

  const fetchPendingDocs = async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('verification_docs')
      .select('*, profiles(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching docs:', fetchError);
      setError(fetchError.message);
    } else if (data) {
      setDocs(data as unknown as VerificationDoc[]);
    }
    
    // Also refresh usage stats when refreshing the list
    await fetchUsage();
    setLoading(false);
  };

  // Helper to format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper for progress bar color
  const getProgressColor = (percent: number) => {
    if (percent > 90) return 'bg-red-500';
    if (percent > 70) return 'bg-yellow-500';
    return 'bg-blue-600';
  };

  const handleApprove = async (docId: string, landlordId: string) => {
    if (!confirm('Are you sure you want to approve this landlord?')) return;

    // 1. Update verification_doc status
    const { error: docError } = await supabase
      .from('verification_docs')
      .update({ status: 'approved' })
      .eq('id', docId);

    if (docError) {
      alert('Error updating document status: ' + docError.message);
      return;
    }

    // 2. Explicitly update the profile verification status
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ is_verified: true })
      .eq('id', landlordId);

    if (profileError) {
      console.error('Error verifying profile:', profileError);
      alert('Document approved, but failed to verify user profile: ' + profileError.message);
    } else {
      // 3. Notify the landlord
      const { error: notifyError } = await supabase.from('notifications').insert({
        user_id: landlordId,
        title: 'Verification Approved! ✅',
        message: 'Your identity has been verified. You can now post lodges and reach more students.',
        type: 'success',
        link: '/profile'
      });

      if (notifyError) console.error('Failed to notify landlord:', notifyError);

      alert('Landlord verified successfully!');
    }

    // Refresh list
    await fetchPendingDocs();
  };

  const handleReject = async (docId: string, landlordId: string) => {
    const reason = prompt('Please enter the reason for rejection (e.g. Image blurry, name mismatch):');
    if (reason === null) return; // Cancelled
    if (!reason.trim()) {
      alert('A reason is required to reject verification.');
      return;
    }

    const { error } = await supabase
      .from('verification_docs')
      .update({ 
        status: 'rejected',
        rejection_reason: reason 
      })
      .eq('id', docId);

    if (error) {
      alert('Error rejecting document: ' + error.message);
    } else {
      // Notify the landlord
      const { error: notifyError } = await supabase.from('notifications').insert({
        user_id: landlordId,
        title: 'Verification Rejected ❌',
        message: `Your verification was not approved. Reason: ${reason}`,
        type: 'error',
        link: '/profile'
      });

      if (notifyError) console.error('Failed to notify landlord:', notifyError);

      alert('Verification rejected.');
      await fetchPendingDocs();
    }
  };

  const getSignedUrl = async (path: string) => {
    if (!path) {
        alert('File path is missing');
        return;
    }
    const { data, error } = await supabase
      .storage
      .from('secure-docs')
      .createSignedUrl(path, 60 * 60); // 1 hour expiry

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      alert('Error generating signed URL');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <button 
          onClick={fetchPendingDocs}
          className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors"
          title="Refresh List"
        >
          <Loader2 size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      
      <div className="space-y-6">
        {/* Usage Monitor Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Cloudinary Card */}
          <div className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900">Cloudinary Media</h3>
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase">Storage</span>
            </div>
            
            {!usage ? (
              <div className="h-20 flex items-center justify-center">
                <Loader2 className="animate-spin text-gray-300" size={20} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="text-2xl font-black text-gray-900">
                    {formatBytes(usage.cloudinary.used)}
                  </div>
                  <div className="text-xs font-bold text-gray-400 uppercase">
                    of {formatBytes(usage.cloudinary.limit)}
                  </div>
                </div>
                
                <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`absolute top-0 left-0 h-full transition-all duration-1000 ${getProgressColor((usage.cloudinary.used / usage.cloudinary.limit) * 100)}`}
                    style={{ width: `${Math.min(100, (usage.cloudinary.used / usage.cloudinary.limit) * 100)}%` }}
                  />
                </div>
                
                <div className="text-[10px] font-bold text-gray-400">
                  {((usage.cloudinary.used / usage.cloudinary.limit) * 100).toFixed(1)}% Capacity Used
                </div>
              </div>
            )}
          </div>

          {/* Supabase Card */}
          <div className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900">Supabase Storage</h3>
              <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg uppercase">DB & Docs</span>
            </div>
            
            {!usage ? (
              <div className="h-20 flex items-center justify-center">
                <Loader2 className="animate-spin text-gray-300" size={20} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="text-2xl font-black text-gray-900">
                    {formatBytes(usage.supabase.used)}
                  </div>
                  <div className="text-xs font-bold text-gray-400 uppercase">
                    of {formatBytes(usage.supabase.limit)}
                  </div>
                </div>
                
                <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`absolute top-0 left-0 h-full transition-all duration-1000 ${getProgressColor((usage.supabase.used / usage.supabase.limit) * 100)}`}
                    style={{ width: `${Math.min(100, (usage.supabase.used / usage.supabase.limit) * 100)}%` }}
                  />
                </div>
                
                <div className="text-[10px] font-bold text-gray-400">
                  {((usage.supabase.used / usage.supabase.limit) * 100).toFixed(1)}% Capacity Used
                </div>
              </div>
            )}
          </div>
        </div>

        <h2 className="text-lg font-bold text-gray-700">Pending Verifications</h2>
        
        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-sm font-bold">
            Error: {error}
          </div>
        )}
        
        {docs.length === 0 && !error ? (
          <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500">
            No pending verifications.
          </div>
        ) : (
          docs.map((doc) => (
            <div key={doc.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">{doc.profiles?.name || 'Unknown User'}</h3>
                  <p className="text-xs text-gray-400 mt-1">Submitted: {new Date(doc.created_at).toLocaleDateString()}</p>
                </div>
                <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded-full uppercase">
                  Pending
                </span>
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <button 
                    onClick={() => getSignedUrl(doc.id_card_path)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                    >
                    <ExternalLink size={14} /> View ID Card
                    </button>
                    {doc.selfie_path && (
                        <button 
                        onClick={() => getSignedUrl(doc.selfie_path!)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                        >
                        <ExternalLink size={14} /> View Selfie
                        </button>
                    )}
                </div>
                
                <div className="flex gap-2 mt-2">
                    <button 
                    onClick={() => handleReject(doc.id, doc.landlord_id)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-red-100 text-red-600 rounded-xl text-sm font-bold active:scale-95 transition-transform"
                    >
                    <XCircle size={16} /> Reject
                    </button>
                    <button 
                    onClick={() => handleApprove(doc.id, doc.landlord_id)}
                    className="flex-[2] flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl text-sm font-bold active:scale-95 transition-transform shadow-lg shadow-green-200"
                    >
                    <CheckCircle size={16} /> Approve Landlord
                    </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}