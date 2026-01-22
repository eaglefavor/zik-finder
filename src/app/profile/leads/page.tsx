'use client';

import { useState, useEffect } from 'react';
import { useAppContext } from '@/lib/context';
import { useZips } from '@/lib/zips-context';
import { supabase } from '@/lib/supabase';
import { Loader2, Lock, Unlock, Phone, MessageCircle, ChevronLeft, MapPin } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Lead {
  id: string;
  student_id: string;
  lodge_id: string;
  status: 'pending' | 'unlocked';
  created_at: string;
  lodges: {
    title: string;
    location: string;
    price: number;
  };
  profiles: {
    name: string; // Sanitized
    phone_number: string; // Only visible if unlocked? No, RLS hides it? 
    // We rely on RPC returning it or RLS allowing it if unlocked.
    // For pending, we show "Student Interest".
  };
}

export default function LeadsPage() {
  const { user, role, isLoading: authLoading } = useAppContext();
  const { wallet, refreshWallet } = useZips();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlockingId, setUnlockId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (user && role === 'landlord') {
      fetchLeads();
    }
  }, [user, role]);

  const fetchLeads = async () => {
    setLoading(true);
    // Use the secure RPC to fetch leads with contact info (if unlocked)
    const { data, error } = await supabase.rpc('get_landlord_leads');

    if (error) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to load leads');
    } else {
      // Transform flat RPC result to match the Lead interface used by the UI
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formatted = (data as any[]).map(row => ({
        id: row.id,
        student_id: 'unknown', // Not needed for display
        lodge_id: 'unknown', // Not needed for display
        status: row.status,
        created_at: row.created_at,
        lodges: {
          title: row.lodge_title,
          location: row.lodge_location,
          price: row.lodge_price
        },
        profiles: {
          name: row.student_name,
          phone_number: row.student_phone
        }
      }));
      setLeads(formatted as Lead[]);
    }
    setLoading(false);
  };

  const handleUnlock = async (lead: Lead) => {
    // Calculate cost preview (Client side estimation, RPC is authority)
    // Logic: <300k = 10, <700k = 15, >700k = 20
    let cost = 10;
    const price = lead.lodges?.price || 0;
    
    if (price >= 700000) cost = 20;
    else if (price >= 300000) cost = 15;

    if (wallet.balance < cost) {
      toast.error(`Insufficient Credits. You need ${cost} Z-Credits.`, {
        action: {
          label: 'Top Up',
          onClick: () => router.push('/wallet')
        }
      });
      return;
    }

    setUnlockId(lead.id);
    try {
      const { data, error } = await supabase.rpc('unlock_lead', { p_lead_id: lead.id });
      
      if (error) throw error;
      if (data.success) {
        toast.success('Lead unlocked! Contact details revealed.');
        await refreshWallet(); // Update balance
        await fetchLeads(); // Refresh list to show contact
      } else {
        toast.error(data.message);
      }
    } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error('Unlock failed: ' + (err as any).message);
    } finally {
      setUnlockId(null);
    }
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  if (role !== 'landlord') {
    return (
      <div className="p-6 text-center">
        <h1 className="text-xl font-bold">Access Denied</h1>
        <Link href="/" className="block mt-4 text-blue-600 font-bold">Go Home</Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 pb-24 max-w-lg mx-auto">
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-white rounded-full shadow-sm border border-gray-100"><ChevronLeft size={20} /></Link>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Inbound Leads</h1>
        </div>
        <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl font-black text-xs">
            {wallet.balance} Credits
        </div>
      </header>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : leads.length === 0 ? (
        <div className="py-20 text-center text-gray-400 font-medium">
            No leads yet. Share your lodge link!
        </div>
      ) : (
        <div className="space-y-4">
            {leads.map(lead => {
                const isUnlocked = lead.status === 'unlocked';
                let cost = 10;
                const price = lead.lodges?.price || 0;
                if (price >= 700000) cost = 20;
                else if (price >= 300000) cost = 15;

                return (
                    <div key={lead.id} className={`p-5 rounded-[24px] border transition-all ${isUnlocked ? 'bg-white border-green-100 shadow-sm' : 'bg-white border-gray-100 shadow-md'}`}>
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">
                                    {isUnlocked ? lead.profiles?.name || 'Unlocked Student' : 'Student Inquiry'}
                                </h3>
                                <p className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-1">
                                    <MapPin size={12} /> {lead.lodges?.title || 'Unknown Lodge'}
                                </p>
                            </div>
                            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                                {new Date(lead.created_at).toLocaleDateString()}
                            </span>
                        </div>

                        {isUnlocked && lead.profiles?.phone_number ? (
                            <div className="flex gap-3 mt-4 animate-in fade-in zoom-in duration-300">
                                <a href={`tel:${lead.profiles.phone_number}`} className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                                    <Phone size={14} /> Call
                                </a>
                                <a href={`https://wa.me/234${lead.profiles.phone_number.substring(1)}`} target="_blank" className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                                    <MessageCircle size={14} /> WhatsApp
                                </a>
                            </div>
                        ) : (
                            <div className="mt-4">
                                <div className="p-3 bg-gray-50 rounded-xl mb-3 flex justify-between items-center">
                                    <span className="text-xs font-bold text-gray-500">{isUnlocked ? 'Contact Missing' : 'Contact Hidden'}</span>
                                    <Lock size={14} className="text-gray-400" />
                                </div>
                                {!isUnlocked && (
                                <button 
                                    onClick={() => handleUnlock(lead)}
                                    disabled={unlockingId === lead.id}
                                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-all"
                                >
                                    {unlockingId === lead.id ? <Loader2 className="animate-spin" size={14} /> : <Unlock size={14} />}
                                    Unlock for {cost} Credits
                                </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
      )}
    </div>
  );
}
