'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Star, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ReviewModalProps {
  lodgeId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReviewModal({ lodgeId, onClose, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a star rating');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('reviews').insert({
        lodge_id: lodgeId,
        student_id: user.id,
        rating,
        comment
      });

      if (error) throw error;

      toast.success('Review submitted successfully!');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Review error:', err);
      toast.error('Failed to submit review');
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
          <h2 className="text-xl font-black text-gray-900">Rate this Lodge</h2>
          <p className="text-sm text-gray-500 font-medium">Share your experience with others</p>
        </div>

        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
              className="p-1 transition-transform hover:scale-110 active:scale-95"
            >
              <Star 
                size={32} 
                className={`${(hoverRating || rating) >= star ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} transition-colors`} 
              />
            </button>
          ))}
        </div>

        <div className="mb-6">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Comments (Optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you like or dislike? e.g. 'Good water supply but noisy neighbors'"
            rows={4}
            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:border-blue-500 outline-none text-sm font-medium resize-none transition-all"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting || rating === 0}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
        >
          {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Submit Review'}
        </button>
      </div>
    </div>,
    document.body
  );
}
