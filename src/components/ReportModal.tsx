'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ReportModalProps {
  lodgeId: string;
  landlordId: string;
  onClose: () => void;
}

type ReasonType = 'scam' | 'wrong_price' | 'misleading' | 'rude' | 'other';

export default function ReportModal({ lodgeId, landlordId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<ReasonType | ''>('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      toast.error('Please select a reason');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('reports').insert({
        lodge_id: lodgeId,
        landlord_id: landlordId,
        reporter_id: user.id,
        reason,
        details
      });

      if (error) throw error;

      toast.success('Report submitted. We will investigate.');
      onClose();
    } catch (err: unknown) {
      console.error('Report error:', err);
      toast.error('Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-xl font-black text-gray-900">Report Listing</h2>
          <p className="text-sm text-gray-500 font-medium">Help us keep ZikLodge safe</p>
        </div>

        <div className="space-y-3 mb-6">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Reason</label>
          <div className="grid grid-cols-1 gap-2">
            {[
              { val: 'scam', label: 'Scam / Fraud' },
              { val: 'wrong_price', label: 'Wrong Price' },
              { val: 'misleading', label: 'Misleading Info' },
              { val: 'rude', label: 'Rude Landlord' },
              { val: 'other', label: 'Other' }
            ].map((opt) => (
              <button
                key={opt.val}
                onClick={() => setReason(opt.val as ReasonType)}
                className={`p-3 rounded-xl text-sm font-bold text-left transition-all ${
                  reason === opt.val 
                    ? 'bg-red-50 text-red-600 border border-red-200' 
                    : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Details (Optional)</label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Provide more context..."
            rows={3}
            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:border-red-500 outline-none text-sm font-medium resize-none transition-all"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !reason}
          className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-200 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
        >
          {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Submit Report'}
        </button>
      </div>
    </div>,
    document.body
  );
}