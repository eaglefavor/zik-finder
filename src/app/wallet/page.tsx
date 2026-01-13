'use client';

import { useState, useEffect } from 'react';
import { useAppContext } from '@/lib/context';
import { useZips } from '@/lib/zips-context';
import { supabase } from '@/lib/supabase';
import WalletCard from '@/components/wallet/WalletCard';
import CreditBundleSelector from '@/components/wallet/CreditBundleSelector';
import { ChevronLeft, History, PlusCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export default function WalletPage() {
  const { user, role, isLoading: authLoading } = useAppContext();
  const { refreshWallet } = useZips();
  const [activeTab, setActiveTab] = useState<'topup' | 'history'>('topup');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    refreshWallet();
  }, []);

  useEffect(() => {
    if (activeTab === 'history' && user) {
      const fetchHistory = async () => {
        setLoadingHistory(true);
        const { data } = await supabase
          .from('credit_transactions')
          .select('*')
          .eq('landlord_id', user.id)
          .order('created_at', { ascending: false });
        
        if (data) setTransactions(data);
        setLoadingHistory(false);
      };
      fetchHistory();
    }
  }, [activeTab, user]);

  if (authLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  if (role !== 'landlord') {
    return (
      <div className="p-6 text-center">
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="text-gray-500">Only landlords have wallets.</p>
        <Link href="/" className="block mt-4 text-blue-600 font-bold">Go Home</Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 pb-24 max-w-lg mx-auto">
      <header className="flex items-center gap-4 mb-6">
        <Link href="/" className="p-2 bg-white rounded-full shadow-sm border border-gray-100"><ChevronLeft size={20} /></Link>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">My Wallet</h1>
      </header>

      <div className="mb-8">
        <WalletCard />
      </div>

      <div className="bg-gray-100 p-1 rounded-2xl flex mb-6">
        <button 
          onClick={() => setActiveTab('topup')} 
          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'topup' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
        >
          <PlusCircle size={16} /> Top Up
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
        >
          <History size={16} /> History
        </button>
      </div>

      {activeTab === 'topup' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 ml-1">Buy Credits</h2>
          <CreditBundleSelector />
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-3">
          {loadingHistory ? (
            <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : transactions.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm font-medium">No transactions yet.</div>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.amount > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                    {tx.amount > 0 ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{tx.description}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">{new Date(tx.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className={`font-black ${tx.amount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
