'use client';

import { useState } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { X, ShieldCheck, Loader2 } from 'lucide-react';
import { PAYSTACK_PUBLIC_KEY } from '@/lib/constants';
import { toast } from 'sonner';

interface PaymentModalProps {
  amount: number; // In Naira
  email: string;
  purpose: string;
  metadata?: Record<string, string | number | boolean>;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

export default function PaymentModal({
  amount,
  email,
  purpose,
  metadata,
  onSuccess,
  onClose,
}: PaymentModalProps) {
  const [isInitializing, setIsInitializing] = useState(false);

  // Paystack config
  const config = {
    reference: (new Date()).getTime().toString(),
    email: email || 'customer@ziklodge.com', // Fallback email to prevent crash
    amount: amount * 100, // Convert to Kobo
    publicKey: PAYSTACK_PUBLIC_KEY,
    metadata: {
        custom_fields: [
            {
                display_name: "Purpose",
                variable_name: "purpose",
                value: purpose
            },
            ...Object.entries(metadata || {}).map(([key, value]) => ({
                display_name: key,
                variable_name: key,
                value: String(value)
            }))
        ]
    }
  };

  const initializePayment = usePaystackPayment(config);

  const handlePay = () => {
    if (!config.email) {
        toast.error("Valid email required for payment.");
        return;
    }
    
    setIsInitializing(true);
    try {
        initializePayment({
            onSuccess: (reference: { reference: string } | string) => {
                setIsInitializing(false);
                const ref = typeof reference === 'string' ? reference : reference.reference;
                onSuccess(ref);
            },
            onClose: () => {
                setIsInitializing(false);
            }
        });
    } catch (err) {
        console.error('Paystack initialization error:', err);
        toast.error("Could not start payment system. Please refresh.");
        setIsInitializing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-6 text-center text-white">
            <div className="mx-auto bg-white/20 w-12 h-12 rounded-full flex items-center justify-center mb-3">
                <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold">Secure Payment</h3>
            <p className="text-indigo-100 text-sm mt-1">via Paystack</p>
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Body */}
        <div className="p-6 space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-500">Service</span>
                <span className="font-medium text-gray-900 capitalize">{purpose.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-2xl text-gray-900">₦{amount.toLocaleString()}</span>
            </div>

            <p className="text-xs text-center text-gray-400 mt-4">
                Your payment is processed securely. We do not store your card details.
            </p>

            <button
                onClick={handlePay}
                disabled={isInitializing}
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isInitializing ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                    </>
                ) : (
                    `Pay Now`
                )}
            </button>
        </div>
      </div>
    </div>
  );
}
