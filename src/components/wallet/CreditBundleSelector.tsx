'use client';

import { useState } from 'react';
import { ZIPS_CONFIG } from '@/lib/config/zips';
import { useZips } from '@/lib/zips-context';
import { Zap } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAppContext } from '@/lib/context';

const PaymentModal = dynamic(() => import('@/components/PaymentModal'), { ssr: false });

export default function CreditBundleSelector() {
  const { purchaseCredits } = useZips();
  const { user } = useAppContext();
  const [selectedBundle, setSelectedBundle] = useState<typeof ZIPS_CONFIG.BUNDLES[0] | null>(null);

  const handleSuccess = async (reference: string) => {
    if (!selectedBundle) return;
    await purchaseCredits(selectedBundle.price, reference);
    setSelectedBundle(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4">
        {ZIPS_CONFIG.BUNDLES.map((bundle) => (
          <button
            key={bundle.name}
            onClick={() => setSelectedBundle(bundle)}
            className="group relative bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm hover:border-blue-500 hover:shadow-lg transition-all text-left overflow-hidden"
          >
            {bundle.bonus > 0 && (
              <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-2xl uppercase tracking-widest">
                +{bundle.bonus} Bonus
              </div>
            )}
            
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{bundle.name}</h3>
              <div className="text-xl font-black text-gray-900">₦{bundle.price.toLocaleString()}</div>
            </div>
            
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Zap size={16} className="text-amber-500 fill-amber-500" />
              <span className="font-bold">{bundle.credits} Credits</span>
            </div>
          </button>
        ))}
      </div>

      {selectedBundle && (
        <PaymentModal
          amount={selectedBundle.price}
          email={user?.email || ''}
          purpose="credit_purchase"
          metadata={{ bundle: selectedBundle.name }}
          onSuccess={handleSuccess}
          onClose={() => setSelectedBundle(null)}
        />
      )}
    </>
  );
}
