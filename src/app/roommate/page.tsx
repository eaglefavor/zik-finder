'use client';

import { useState, useEffect } from 'react';
import { useAppContext } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { RoommateListing } from '@/lib/types';
import { Loader2, Filter, MapPin, User, Search, PlusCircle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function RoommateFeed() {
  const { user, isLoading: authLoading } = useAppContext();
  const [listings, setListings] = useState<RoommateListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'have_room' | 'need_room'>('all');

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      
      // Query: Get listings, embed the user profile, and nested roommate profile
      let query = supabase
        .from('roommate_listings')
        .select(`
          *,
          profiles:user_id (
            name,
            avatar_url,
            role,
            roommate_profiles:roommate_profiles!roommate_profiles_user_id_fkey (
              gender,
              level,
              department,
              habits
            )
          )
        `)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching roommate listings:', error);
        toast.error('Failed to load feed');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setListings(data as any[]);
      }
      setLoading(false);
    };

    fetchListings();
  }, [filterType]);

  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-30 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              Roommate Matcher <Sparkles className="text-purple-500 fill-purple-500" size={18} />
            </h1>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Find your tribe • Free & Safe</p>
          </div>
          <Link 
            href="/roommate/post" 
            className="p-2 bg-gray-900 text-white rounded-xl shadow-lg active:scale-95 transition-all"
          >
            <PlusCircle size={24} />
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button 
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
              filterType === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'
            }`}
          >
            All Posts
          </button>
          <button 
            onClick={() => setFilterType('have_room')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
              filterType === 'have_room' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'
            }`}
          >
            Has Room
          </button>
          <button 
            onClick={() => setFilterType('need_room')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
              filterType === 'need_room' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200'
            }`}
          >
            Needs Room
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="px-4 py-6 space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white h-48 rounded-[32px] animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
              <User size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No listings yet</h3>
            <p className="text-gray-500 text-sm mt-2 mb-6">Be the first to post!</p>
            <Link href="/roommate/post" className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold text-sm">Create Post</Link>
          </div>
        ) : (
          <AnimatePresence>
            {listings.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl overflow-hidden relative shrink-0 border border-gray-100">
                    {item.profiles?.avatar_url ? (
                      <Image src={item.profiles.avatar_url} fill className="object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
                        <User size={24} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-gray-900 text-base truncate">{item.profiles?.name || 'Student'}</h3>
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                        item.type === 'have_room' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                      }`}>
                        {item.type === 'have_room' ? 'Has Room' : 'Seeker'}
                      </span>
                    </div>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <p className="text-xs text-gray-500 font-medium">{(item as any).roommate_profiles?.level || 'Student'} • {(item as any).roommate_profiles?.department || 'Unizik'}</p>
                  </div>
                </div>

                {item.images && item.images.length > 0 && (
                  <div className="h-40 w-full bg-gray-100 rounded-2xl mb-4 overflow-hidden relative">
                    <Image src={item.images[0]} fill className="object-cover" alt="Room" />
                    {item.images.length > 1 && (
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-lg font-bold backdrop-blur-sm">
                        +{item.images.length - 1}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="px-2.5 py-1 bg-gray-50 text-gray-600 text-[10px] font-bold rounded-lg border border-gray-100 flex items-center gap-1">
                    <MapPin size={10} /> {item.location_area}
                  </span>
                  <span className="px-2.5 py-1 bg-gray-50 text-gray-600 text-[10px] font-bold rounded-lg border border-gray-100">
                    ₦{item.rent_per_person?.toLocaleString()}/{item.payment_period === 'Yearly' ? 'yr' : 'sem'}
                  </span>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(item as any).roommate_profiles?.gender && (
                    <span className="px-2.5 py-1 bg-purple-50 text-purple-600 text-[10px] font-bold rounded-lg border border-purple-100">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(item as any).roommate_profiles?.gender} Only
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600 mb-6 line-clamp-3 leading-relaxed italic border-l-2 border-gray-200 pl-3">
                  &quot;{item.description}&quot;
                </p>

                <div className="flex gap-3">
                  <button 
                    onClick={() => toast.info('Coming soon: Full profile view')}
                    className="flex-1 py-3.5 bg-gray-50 text-gray-700 rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all"
                  >
                    View Profile
                  </button>
                  <button 
                    onClick={() => toast.success('Request sent! (Simulation)')}
                    className="flex-[1.5] py-3.5 bg-gray-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                  >
                    Request to Pair
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
