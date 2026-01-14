'use client';

import { useAppContext } from '@/lib/context';
import { useData } from '@/lib/data-context';
import { supabase } from '@/lib/supabase';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Loader2, ExternalLink, Megaphone, Building, LayoutDashboard, Trash2, Eye, EyeOff, Send, Globe, Users as UsersIcon, Banknote, AlertTriangle, UserX } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

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

interface Report {
  id: string;
  reporter_id: string;
  lodge_id: string;
  landlord_id: string;
  reason: 'scam' | 'wrong_price' | 'misleading' | 'rude' | 'other';
  details?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
  reporter: { name: string; email: string };
  landlord: { name: string; email: string };
  lodge: { title: string; location: string; price: number; image_urls: string[]; status: string };
}

export default function AdminPage() {
  const { user, role, isLoading: authLoading } = useAppContext();
  const { lodges, deleteLodge, updateLodgeStatus } = useData();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'stats' | 'verifications' | 'lodges' | 'broadcast' | 'finance' | 'reports'>('stats');
  const [docs, setDocs] = useState<VerificationDoc[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // Finance State
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [transactions, setTransactions] = useState<any[]>([]);
  const [revenueStats, setRevenueStats] = useState({
    total: 0,
    verification: 0,
    promoted: 0,
    today: 0
  });

  const [broadcast, setBroadcast] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
    target: 'all' as 'all' | 'landlord' | 'student'
  });
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const [usage, setUsage] = useState<{ cloudinary: { used: number, limit: number }, supabase: { used: number, limit: number } } | null>(null);

  const fetchUsage = useCallback(async () => {
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
  }, []);

  const fetchTransactions = useCallback(async () => {
    const { data, error } = await supabase
        .from('monetization_transactions')
        .select('*')
        .eq('status', 'success')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching transactions:', error);
        return;
    }

    if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setTransactions(data as any[]);
        
        // Calculate Stats
        let total = 0;
        let verification = 0;
        let promoted = 0;
        let today = 0;
        const now = new Date();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.forEach((tx: any) => {
            const amount = Number(tx.amount);
            total += amount;
            if (tx.purpose === 'verification_fee') verification += amount;
            if (tx.purpose === 'promoted_listing') promoted += amount;

            const txDate = new Date(tx.created_at);
            if (txDate.toDateString() === now.toDateString()) {
                today += amount;
            }
        });

        setRevenueStats({ total, verification, promoted, today });
    }
  }, []);

  const fetchReports = useCallback(async () => {
    console.log('Fetching reports...');
    const { data, error } = await supabase
      .from('reports')
      .select('*, reporter:profiles!reports_reporter_id_fkey(name, email), landlord:profiles!reports_landlord_id_fkey(name, email), lodge:lodges(title, location, price, image_urls, status)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    console.log('Reports fetch result:', { data, error });

    if (error) {
      console.error('Error fetching reports:', error);
    } else {
      setReports(data as unknown as Report[]);
    }
  }, []);

  const fetchPendingDocs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    
    await Promise.all([
        supabase
          .from('verification_docs')
          .select('*, profiles(name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .then(({ data }) => data && setDocs(data as unknown as VerificationDoc[])),
        fetchReports()
    ]);
    
    // Also refresh usage stats when refreshing the list
    await fetchUsage();
    if (!silent) setLoading(false);
  }, [fetchUsage, fetchReports]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || role !== 'admin') {
        router.push('/');
        return;
      }
      
      // Defer execution to avoid synchronous setState in effect
      setTimeout(() => {
        fetchPendingDocs().finally(() => setLoading(false));
      }, 0);
    }
  }, [user, role, authLoading, router, fetchPendingDocs, fetchUsage]);

  useEffect(() => {
    if (activeTab === 'finance') {
        fetchTransactions();
    }
  }, [activeTab, fetchTransactions]);

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

  const handleApprove = async (docId: string, landlordId: string, paths: string[]) => {
    toast.info('Approve this landlord?', {
      description: 'This will verify their identity and allow them to post listings.',
      action: {
        label: 'Approve',
        onClick: async () => {
          // 1. Update verification_doc status
          const { error: docError } = await supabase
            .from('verification_docs')
            .update({ status: 'approved' })
            .eq('id', docId);

          if (docError) {
            toast.error('Error updating document status: ' + docError.message);
            return;
          }

          // 2. Explicitly update the profile verification status
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ is_verified: true })
            .eq('id', landlordId);

          if (profileError) {
            console.error('Error verifying profile:', profileError);
            toast.error('Document approved, but failed to verify user profile: ' + profileError.message);
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

            // 4. Delete images from Storage (Cleanup)
            if (paths.length > 0) {
                const { error: deleteError } = await supabase.storage
                    .from('secure-docs')
                    .remove(paths);
                
                if (deleteError) {
                    console.error('Failed to cleanup verification docs:', deleteError);
                }
            }

            toast.success('Landlord verified successfully!');
          }

          // Refresh list
          await fetchPendingDocs();
        }
      }
    });
  };

  const handleReject = async (docId: string, landlordId: string, paths: string[]) => {
    const reason = prompt('Please enter the reason for rejection (e.g. Image blurry, name mismatch):');
    if (reason === null) return; // Cancelled
    if (!reason.trim()) {
      toast.error('A reason is required to reject verification.');
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
      toast.error('Error rejecting document: ' + error.message);
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

      // Delete images from Storage (Cleanup)
      if (paths.length > 0) {
        const { error: deleteError } = await supabase.storage
            .from('secure-docs')
            .remove(paths);
        
        if (deleteError) {
            console.error('Failed to cleanup verification docs:', deleteError);
        }
      }

      toast.success('Verification rejected.');
      await fetchPendingDocs();
    }
  };

  const getSignedUrl = async (path: string) => {
    if (!path) {
        toast.error('File path is missing');
        return;
    }
    const { data, error: signedUrlError } = await supabase
      .storage
      .from('secure-docs')
      .createSignedUrl(path, 60 * 60); // 1 hour expiry

    if (signedUrlError) {
      console.error('Error generating signed URL:', signedUrlError);
      toast.error('Error generating signed URL: ' + signedUrlError.message);
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      toast.error('Error: Signed URL not generated');
    }
  };

  const handleAdminLodgeDelete = async (lodgeId: string) => {
    toast.error('PERMANENTLY DELETE this lodge?', {
      description: 'This action cannot be undone.',
      action: {
        label: 'Delete Forever',
        onClick: async () => {
          await deleteLodge(lodgeId);
          toast.success('Lodge deleted permanently');
        }
      }
    });
  };

  const handleResolveReport = async (reportId: string) => {
    toast.info('Mark as Resolved?', {
      description: 'This will permanently remove the report record.',
      action: {
        label: 'Resolve & Delete',
        onClick: async () => {
          const { error } = await supabase.from('reports').delete().eq('id', reportId);
          if (error) {
            console.error('Error resolving report:', error);
            toast.error('Failed to resolve report: ' + error.message);
          } else {
            toast.success('Report resolved and deleted');
            fetchReports();
          }
        }
      }
    });
  };

  const handleDismissReport = async (reportId: string) => {
    const { error } = await supabase.from('reports').delete().eq('id', reportId);
    if (error) {
        console.error('Error dismissing report:', error);
        toast.error('Failed to dismiss report: ' + error.message);
    } else {
      toast.success('Report dismissed and deleted');
      fetchReports();
    }
  };

  const handleBanLandlord = async (landlordId: string, reportId: string) => {
    const reason = prompt('Reason for BAN:');
    if (!reason) return;

    toast.error('PERMANENTLY BAN this Landlord?', {
      description: 'This will hide all their lodges, disable their account, and delete the report.',
      action: {
        label: 'BAN FOREVER',
        onClick: async () => {
          // 1. Hide all lodges
          await supabase.from('lodges').update({ status: 'taken' }).eq('landlord_id', landlordId);
          
          // 2. Mark profile as unverified
          await supabase.from('profiles').update({ is_verified: false }).eq('id', landlordId);
          
          // 3. Update wallet (Negative Score)
          await supabase.from('landlord_wallets').update({ z_score: -100 }).eq('landlord_id', landlordId);

          // 4. Delete report
          await supabase.from('reports').delete().eq('id', reportId);

          toast.success('Landlord Banned and Report Deleted');
          fetchReports();
        }
      }
    });
  };

  const handleSendBroadcast = async () => {
    if (!broadcast.title || !broadcast.message) {
      toast.error('Please provide both title and message.');
      return;
    }

    setSendingBroadcast(true);
    try {
      const { error } = await supabase.rpc('broadcast_notification', {
        p_title: broadcast.title,
        p_message: broadcast.message,
        p_type: broadcast.type,
        p_target_role: broadcast.target
      });

      if (error) throw error;

      toast.success('Broadcast sent successfully!');
      setBroadcast({ ...broadcast, title: '', message: '' });
    } catch (err: unknown) {
      toast.error('Error sending broadcast: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSendingBroadcast(false);
    }
  };

  const toggleLodgeSuspension = async (lodgeId: string, currentStatus: string, landlordId: string, lodgeTitle: string) => {
    const newStatus = currentStatus === 'suspended' ? 'available' : 'suspended';
    
    await updateLodgeStatus(lodgeId, newStatus as any); // Cast for now until context types update propagates

    if (newStatus === 'suspended') {
      await supabase.from('notifications').insert({
        user_id: landlordId,
        title: 'Listing Suspended ⚠️',
        message: `Your lodge "${lodgeTitle}" has been suspended by an admin for violating our policies. Please contact support.`,
        type: 'error',
        link: '/profile' // Direct them to dashboard to see the suspended status
      });
      toast.success('Lodge suspended and landlord notified.');
    } else {
      toast.success('Lodge re-activated.');
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
    <div className="px-4 py-6 pb-24">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Admin</h1>
        <button 
          onClick={() => fetchPendingDocs()}
          className="p-2.5 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <Loader2 size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Admin Tabs */}
      <div className="flex flex-wrap bg-gray-100 p-1 rounded-2xl mb-8">
        <button 
          onClick={() => setActiveTab('stats')}
          className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'stats' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
        >
          <LayoutDashboard size={16} /> Stats
        </button>
        <button 
          onClick={() => setActiveTab('verifications')}
          className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'verifications' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
        >
          <CheckCircle size={16} /> Verify
          {docs.length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('lodges')}
          className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'lodges' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
        >
          <Building size={16} /> Lodges
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'reports' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
        >
          <AlertTriangle size={16} /> Reports
          {reports.length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('finance')}
          className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'finance' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
        >
          <Banknote size={16} /> Revenue
        </button>
        <button 
          onClick={() => setActiveTab('broadcast')}
          className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'broadcast' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
        >
          <Megaphone size={16} /> Alert
        </button>
      </div>
      
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cloudinary Card */}
              <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900">Cloudinary</h3>
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase">Media</span>
                </div>
                {!usage ? <div className="h-20 flex items-center justify-center"><Loader2 className="animate-spin text-gray-200" size={20} /></div> : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="text-2xl font-black text-gray-900">{formatBytes(usage.cloudinary.used)}</div>
                      <div className="text-xs font-bold text-gray-400 uppercase">of {formatBytes(usage.cloudinary.limit)}</div>
                    </div>
                    <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`absolute top-0 left-0 h-full transition-all duration-1000 ${getProgressColor((usage.cloudinary.used / usage.cloudinary.limit) * 100)}`} style={{ width: `${Math.min(100, (usage.cloudinary.used / usage.cloudinary.limit) * 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Supabase Card */}
              <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900">Supabase</h3>
                  <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg uppercase">Storage</span>
                </div>
                {!usage ? <div className="h-20 flex items-center justify-center"><Loader2 className="animate-spin text-gray-200" size={20} /></div> : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="text-2xl font-black text-gray-900">{formatBytes(usage.supabase.used)}</div>
                      <div className="text-xs font-bold text-gray-400 uppercase">of {formatBytes(usage.supabase.limit)}</div>
                    </div>
                    <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`absolute top-0 left-0 h-full transition-all duration-1000 ${getProgressColor((usage.supabase.used / usage.supabase.limit) * 100)}`} style={{ width: `${Math.min(100, (usage.supabase.used / usage.supabase.limit) * 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-600 p-6 rounded-[32px] text-white shadow-xl shadow-blue-100">
               <h3 className="font-bold opacity-80 uppercase text-[10px] tracking-widest mb-1">System Health</h3>
               <div className="text-3xl font-black mb-4">All Systems Operational</div>
               <div className="flex gap-4">
                  <div className="bg-white/10 px-4 py-2 rounded-2xl flex-1 border border-white/10">
                     <div className="text-xl font-bold">{lodges.length}</div>
                     <div className="text-[10px] font-bold opacity-60">Total Lodges</div>
                  </div>
                  <div className="bg-white/10 px-4 py-2 rounded-2xl flex-1 border border-white/10">
                     <div className="text-xl font-bold">{docs.length}</div>
                     <div className="text-[10px] font-bold opacity-60">Pending Docs</div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'verifications' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Pending Landlords</h2>
            {docs.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-[32px] border border-dashed border-gray-200 text-gray-400 font-bold">
                No pending verifications.
              </div>
            ) : (
              docs.map((doc) => (
                <div key={doc.id} className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-900">{doc.profiles?.name || 'Unknown User'}</h3>
                      <p className="text-xs text-gray-400 mt-1 uppercase font-black tracking-tighter">Submitted: {new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className="bg-yellow-50 text-yellow-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest">Pending</span>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <button onClick={() => getSignedUrl(doc.id_card_path)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-2xl text-xs font-bold active:scale-95 transition-all"><ExternalLink size={14} /> ID Card</button>
                        {doc.selfie_path && <button onClick={() => getSignedUrl(doc.selfie_path!)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-50 text-purple-600 rounded-2xl text-xs font-bold active:scale-95 transition-all"><ExternalLink size={14} /> Selfie</button>}
                    </div>
                    <div className="flex gap-2 mt-2">
                        <button onClick={() => handleReject(doc.id, doc.landlord_id, [doc.id_card_path, doc.selfie_path].filter(Boolean) as string[])} className="flex-1 py-4 border border-red-100 text-red-600 rounded-2xl text-sm font-bold active:scale-95 transition-all">Reject</button>
                        <button onClick={() => handleApprove(doc.id, doc.landlord_id, [doc.id_card_path, doc.selfie_path].filter(Boolean) as string[])} className="flex-[2] py-4 bg-green-600 text-white rounded-2xl text-sm font-bold active:scale-95 transition-all shadow-lg shadow-green-100">Approve Landlord</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'lodges' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Moderate Listings</h2>
            {lodges.length === 0 ? <p className="text-center py-10 text-gray-400">No lodges in system.</p> : (
              <div className="space-y-3">
                {lodges.map(l => (
                  <div key={l.id} className="bg-white p-4 rounded-[24px] border border-gray-100 flex items-center gap-4 shadow-sm">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                      <Image src={l.image_urls[0]} fill className="object-cover" alt={l.title} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 truncate">{l.title}</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase">{l.location} • ₦{l.price.toLocaleString()}</div>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => toggleLodgeSuspension(l.id, l.status, l.landlord_id, l.title)}
                        className={`p-2 rounded-full ${l.status === 'available' ? 'text-green-500 bg-green-50' : l.status === 'suspended' ? 'text-red-500 bg-red-50' : 'text-gray-400 bg-gray-50'}`}
                        title={l.status === 'available' ? 'Public' : l.status === 'suspended' ? 'Suspended' : 'Hidden'}
                      >
                        {l.status === 'available' ? <Eye size={18} /> : l.status === 'suspended' ? <ShieldCheck size={18} /> : <EyeOff size={18} />}
                      </button>
                      <button 
                        onClick={() => handleAdminLodgeDelete(l.id)}
                        className="p-2 text-red-400 bg-red-50 rounded-full hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'finance' && (
            <div className="space-y-6">
                {/* Revenue Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-green-50 border border-green-100 p-4 rounded-[24px]">
                        <p className="text-[9px] uppercase font-black tracking-widest text-green-600 mb-1">Total</p>
                        <p className="text-xl font-black text-gray-900">₦{revenueStats.total.toLocaleString()}</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-[24px]">
                        <p className="text-[9px] uppercase font-black tracking-widest text-blue-600 mb-1">Verify</p>
                        <p className="text-xl font-black text-gray-900">₦{revenueStats.verification.toLocaleString()}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-[24px]">
                        <p className="text-[9px] uppercase font-black tracking-widest text-amber-600 mb-1">Boosts</p>
                        <p className="text-xl font-black text-gray-900">₦{revenueStats.promoted.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 p-4 rounded-[24px]">
                        <p className="text-[9px] uppercase font-black tracking-widest text-gray-500 mb-1">Today</p>
                        <p className="text-xl font-black text-gray-900">₦{revenueStats.today.toLocaleString()}</p>
                    </div>
                </div>

                {/* Transactions List */}
                <div className="bg-white border border-gray-100 rounded-[32px] overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-gray-50">
                        <h3 className="font-bold text-gray-900">Recent Transactions</h3>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto">
                        {transactions.length === 0 ? (
                            <div className="p-10 text-center text-gray-400 text-sm font-medium">No transactions yet.</div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-bold text-[10px] uppercase tracking-widest sticky top-0">
                                    <tr>
                                        <th className="p-4">Reference</th>
                                        <th className="p-4">Type</th>
                                        <th className="p-4">Amount</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {transactions.map((tx) => (
                                        <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="p-4 font-mono text-xs text-gray-600">{tx.reference.substring(0, 12)}...</td>
                                            <td className="p-4 capitalize font-bold text-gray-800">{tx.purpose.replace('_', ' ')}</td>
                                            <td className="p-4 font-bold text-green-600">₦{tx.amount.toLocaleString()}</td>
                                            <td className="p-4 text-gray-500 text-xs">{new Date(tx.created_at).toLocaleDateString()}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${tx.status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                                    {tx.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2 px-1">Pending Investigation</h2>
            {reports.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-[32px] border border-dashed border-gray-200 text-gray-400 font-bold shadow-sm">
                No active reports.
              </div>
            ) : (
              reports.map((report) => (
                <div key={report.id} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-lg space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="bg-red-50 text-red-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border border-red-100 mb-2 inline-block">
                        {report.reason.replace('_', ' ')}
                      </span>
                      <h3 className="font-black text-gray-900 text-lg leading-tight">Reported by {report.reporter?.name}</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter mt-1">Submitted: {new Date(report.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handleDismissReport(report.id)} className="p-2.5 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-xl transition-colors" title="Dismiss Report">
                            <EyeOff size={18} />
                        </button>
                    </div>
                  </div>

                  {report.details && (
                    <div className="bg-gray-50 p-4 rounded-2xl text-sm italic text-gray-600 border-l-4 border-red-400 font-medium">
                      &quot;{report.details}&quot;
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Reported Lodge</h4>
                        <div className="flex gap-4">
                            <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-50 shadow-inner">
                                <Image src={report.lodge.image_urls[0]} fill className="object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-black text-gray-900 truncate leading-tight">{report.lodge.title}</p>
                                <p className="text-xs text-gray-500 font-medium mt-1">{report.lodge.location}</p>
                                <p className="text-sm font-black text-blue-600 mt-2">₦{report.lodge.price.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="mt-5 flex gap-2">
                            <button 
                                onClick={() => toggleLodgeSuspension(report.lodge_id, report.lodge.status, report.landlord_id, report.lodge.title)}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    report.lodge.status === 'suspended' ? 'bg-green-600 text-white' : 'bg-gray-900 text-white shadow-xl shadow-gray-200'
                                }`}
                            >
                                {report.lodge.status === 'suspended' ? 'Re-Activate' : 'Suspend Listing'}
                            </button>
                            <Link href={`/lodge/${report.lodge_id}`} className="p-3 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-100 transition-colors shadow-sm">
                                <ExternalLink size={18} />
                            </Link>
                        </div>
                    </div>

                    <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Landlord Profile</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400 font-bold">Name</span>
                                <span className="font-black text-gray-900">{report.landlord?.name}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400 font-bold">Email</span>
                                <span className="font-medium text-gray-900 truncate max-w-[150px]">{report.landlord?.email}</span>
                            </div>
                        </div>
                        <div className="mt-5 flex gap-2 pt-5 border-t border-gray-50">
                            <button 
                                onClick={() => handleBanLandlord(report.landlord_id, report.id)}
                                className="flex-1 py-3.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-100 flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                                <UserX size={16} /> Ban Landlord
                            </button>
                        </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleResolveReport(report.id)}
                    className="w-full py-4 border-2 border-green-50 text-green-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-green-50 transition-all active:scale-[0.98]"
                  >
                    Mark as Resolved
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'broadcast' && (
          <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Global Broadcast</h2>
              <p className="text-xs text-gray-500">Send an instant notification to many users.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setBroadcast({...broadcast, target: 'all'})}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold border transition-all ${broadcast.target === 'all' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-500 border-gray-100'}`}
                >
                  <Globe size={14} /> All Users
                </button>
                <button 
                  onClick={() => setBroadcast({...broadcast, target: 'landlord'})}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold border transition-all ${broadcast.target === 'landlord' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-500 border-gray-100'}`}
                >
                  <UsersIcon size={14} /> Landlords
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Notification Title</label>
                <input 
                  type="text" 
                  value={broadcast.title}
                  onChange={e => setBroadcast({...broadcast, title: e.target.value})}
                  placeholder="e.g. Maintenance Update"
                  className="w-full p-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Message Body</label>
                <textarea 
                  value={broadcast.message}
                  onChange={e => setBroadcast({...broadcast, message: e.target.value})}
                  placeholder="Write your message here..."
                  rows={4}
                  className="w-full p-4 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all text-sm font-medium"
                />
              </div>

              <div className="flex gap-2">
                {(['info', 'success', 'warning', 'error'] as const).map(t => (
                  <button 
                    key={t}
                    onClick={() => setBroadcast({...broadcast, type: t})}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase border transition-all ${broadcast.type === t ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white text-gray-400 border-gray-100'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <button 
                onClick={handleSendBroadcast}
                disabled={sendingBroadcast || !broadcast.title || !broadcast.message}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-blue-100 mt-4"
              >
                {sendingBroadcast ? <Loader2 className="animate-spin" size={20} /> : <><Send size={20} /> Send Broadcast</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}