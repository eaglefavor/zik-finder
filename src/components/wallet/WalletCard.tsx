'use client';

import { useZips } from '@/lib/zips-context';
import { Loader2, Zap, ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function WalletCard() {
  const { wallet, isLoading } = useZips();

  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-[32px] p-6 text-white h-[200px] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-[32px] p-6 text-white relative overflow-hidden shadow-xl shadow-gray-200">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Balance</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black">{wallet.balance.toLocaleString()}</span>
              <span className="text-sm font-bold text-blue-400">Credits</span>
            </div>
          </div>
          <Link href="/wallet" className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-bold transition-colors backdrop-blur-sm border border-white/10">
            Top Up
          </Link>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={14} className={wallet.z_score < 30 ? 'text-red-400' : 'text-green-400'} />
              <span className="text-[10px] font-bold uppercase text-gray-400">Trust Score</span>
            </div>
            <div className="font-black text-lg">{wallet.z_score}</div>
          </div>
          
          <div className="flex-1 bg-white/5 rounded-2xl p-3 border border-white/5">
             {wallet.z_score < 30 ? (
                <div className="flex items-center gap-2 h-full text-red-300">
                    <AlertTriangle size={16} />
                    <span className="text-[10px] font-bold leading-tight">Risk of Shadowban</span>
                </div>
             ) : (
                <div className="flex items-center gap-2 h-full text-blue-300">
                    <TrendingUp size={16} />
                    <span className="text-[10px] font-bold leading-tight">High Visibility</span>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
