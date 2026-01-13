'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAppContext } from './context';
import { toast } from 'sonner';

interface WalletStats {
  balance: number;
  z_score: number;
  is_verified: boolean;
  verified_at: string | null;
}

interface ZipsContextType {
  wallet: WalletStats;
  isLoading: boolean;
  refreshWallet: () => Promise<void>;
  purchaseCredits: (amountNaira: number, reference: string) => Promise<void>;
}

const ZipsContext = createContext<ZipsContextType | undefined>(undefined);

export function ZipsProvider({ children }: { children: React.ReactNode }) {
  const { user, role } = useAppContext();
  const [wallet, setWallet] = useState<WalletStats>({
    balance: 0,
    z_score: 50,
    is_verified: false,
    verified_at: null
  });
  const [isLoading, setIsLoading] = useState(true);

  const refreshWallet = async () => {
    if (!user || role !== 'landlord') {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_wallet_stats', {
        p_user_id: user.id
      });

      if (error) throw error;

      if (data) {
        setWallet(data as WalletStats);
      }
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const purchaseCredits = async (amountNaira: number, reference: string) => {
    if (!user) return;

    // Call the Edge Function to verify payment and credit wallet
    const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: {
            reference,
            type: 'credit_purchase',
            metadata: { user_id: user.id }
        }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    await refreshWallet();
    toast.success(`Successfully added ${data.credits_added} Z-Credits!`);
  };

  useEffect(() => {
    refreshWallet();
  }, [user, role]);

  return (
    <ZipsContext.Provider value={{ 
      wallet, 
      isLoading, 
      refreshWallet,
      purchaseCredits
    }}>
      {children}
    </ZipsContext.Provider>
  );
}

export function useZips() {
  const context = useContext(ZipsContext);
  if (context === undefined) {
    throw new Error('useZips must be used within a ZipsProvider');
  }
  return context;
}
