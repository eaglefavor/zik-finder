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

  useEffect(() => {
    if (!authLoading) {
      if (!user || role !== 'admin') {
        router.push('/');
        return;
      }
      fetchPendingDocs();
    }
  }, [user, role, authLoading, router]);

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
    setLoading(false);
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
      alert('Landlord verified successfully!');
    }

    // Refresh list
    await fetchPendingDocs();
  };

  const handleReject = async (docId: string) => {
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
      
      <div className="space-y-6">
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
                    onClick={() => handleReject(doc.id)}
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