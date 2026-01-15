'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Star, MessageCircle, Send, Image as ImageIcon, Trash2, MoreVertical, Reply, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import Image from 'next/image';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface ReviewReply {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
    avatar_url?: string;
  };
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  image_urls: string[];
  profiles: {
    name: string;
    avatar_url?: string;
  };
  replies?: ReviewReply[];
}

export default function LodgeReviewsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAppContext();
  
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [id]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          profiles(name, avatar_url),
          replies:review_replies(
            id, content, created_at, user_id,
            profiles(name, avatar_url)
          )
        `)
        .eq('lodge_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data as unknown as Review[]);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleReplySubmit = async (reviewId: string) => {
    if (!user) {
      toast.error('Please log in to reply');
      return;
    }
    if (!replyContent.trim()) return;

    setSubmittingReply(true);
    try {
      const { error } = await supabase.from('review_replies').insert({
        review_id: reviewId,
        user_id: user.id,
        content: replyContent
      });

      if (error) throw error;
      
      toast.success('Reply posted');
      setReplyContent('');
      setReplyingTo(null);
      fetchReviews();
    } catch (err) {
      console.error('Error submitting reply:', err);
      toast.error('Failed to post reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm border border-gray-100 active:scale-90 transition-transform">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">Reviews</h1>
            <p className="text-xs text-gray-500 font-bold">{reviews.length} Reviews</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-6">
        {reviews.map((review) => (
          <div key={review.id} className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm animate-in fade-in duration-500">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-full bg-gray-100 overflow-hidden border border-gray-100">
                  {review.profiles.avatar_url ? (
                    <Image src={review.profiles.avatar_url} fill className="object-cover" alt="" />
                  ) : (
                    <span className="flex items-center justify-center h-full w-full text-gray-400 font-bold text-xs">
                      {review.profiles.name[0]}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{review.profiles.name}</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">
                    {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className="flex items-center bg-amber-50 px-2 py-1 rounded-lg">
                <Star size={12} className="text-amber-500 fill-amber-500 mr-1" />
                <span className="text-xs font-black text-amber-700">{review.rating}</span>
              </div>
            </div>

            <p className="text-sm text-gray-600 font-medium leading-relaxed mb-4">
              {review.comment}
            </p>

            {review.image_urls && review.image_urls.length > 0 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {review.image_urls.map((url, i) => (
                  <div key={i} className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-gray-100">
                    <Image src={url} fill className="object-cover" alt={`Review attachment ${i}`} />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
              <button 
                onClick={() => setReplyingTo(replyingTo === review.id ? null : review.id)}
                className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors"
              >
                <MessageCircle size={16} />
                {review.replies?.length || 0} Replies
              </button>
              
              <button className="text-gray-400 hover:text-gray-600">
                <MoreVertical size={16} />
              </button>
            </div>

            {/* Replies Section */}
            {((review.replies && review.replies.length > 0) || replyingTo === review.id) && (
              <div className="mt-4 pl-4 border-l-2 border-gray-50 space-y-4">
                {review.replies?.map((reply) => (
                  <div key={reply.id} className="bg-gray-50 p-3 rounded-2xl">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-gray-900">{reply.profiles.name}</span>
                      <span className="text-[10px] text-gray-400">
                        {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">{reply.content}</p>
                  </div>
                ))}

                {replyingTo === review.id && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Write a reply..."
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-medium focus:border-blue-500 outline-none"
                      autoFocus
                    />
                    <button 
                      onClick={() => handleReplySubmit(review.id)}
                      disabled={submittingReply || !replyContent.trim()}
                      className="p-2 bg-blue-600 text-white rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                    >
                      {submittingReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}