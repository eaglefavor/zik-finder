'use client';

import { useAppContext } from '@/lib/context';
import { useData } from '@/lib/data-context';
import { LodgeSkeleton } from '@/components/Skeleton';
import { MapPin, Phone, MessageCircle, Heart, ChevronLeft, CheckCircle, Loader2, Sparkles, Building2, LayoutGrid, ShieldCheck, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Lodge } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Image from 'next/image';

export default function FavoritesPage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useAppContext();
  const { lodges, favorites, toggleFavorite, isLoading: isDataLoading } = useData();
  const [studentLeads, setStudentLeads] = useState<Record<string, { status: string, phone?: string }>>({});
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const fetchStudentLeads = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('leads')
      .select('lodge_id, status, profiles!leads_landlord_id_fkey(phone_number)')
      .eq('student_id', user.id)
      .eq('type', 'inbound');
    
    if (data) {
      const map: Record<string, { status: string, phone?: string }> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.forEach((l: any) => {
        map[l.lodge_id] = { 
          status: l.status, 
          phone: l.status === 'unlocked' ? l.profiles?.phone_number : undefined 
        };
      });
      setStudentLeads(map);
    }
  }, [user]);

  useEffect(() => {
    fetchStudentLeads();
  }, [fetchStudentLeads]);

  const handleRequestChat = async (lodgeId: string) => {
    if (!user) {
      toast.error("Please log in to contact landlords");
      return;
    }
    
    setRequestingId(lodgeId);
    try {
      const { data, error } = await supabase.rpc('create_inbound_lead', {
        p_lodge_id: lodgeId
      });

      if (error) throw error;
      if (data.success) {
        toast.success("Request sent! You'll be notified when the landlord accepts.");
        await fetchStudentLeads();
      } else {
        toast.error(data.message);
      }
    } catch (err: unknown) {
      toast.error('Failed to send request');
    } finally {
      setRequestingId(null);
    }
  };

  if (isUserLoading || isDataLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 px-4 py-6">
        <div className="space-y-4 mb-10">
          <div className="h-10 w-48 bg-gray-200 rounded-2xl animate-pulse" />
        </div>
        <div className="space-y-8">
          {[1, 2].map(i => <LodgeSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  // Filter lodges that are in the favorites list
  const favoriteLodges = lodges.filter(lodge => favorites.includes(lodge.id));

  return (
    <div className="min-h-screen bg-gray-50/50 pb-32">
      {/* Premium Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 py-6 shadow-sm shadow-gray-100/50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()} 
              className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all active:scale-90 shadow-sm"
            >
              <ChevronLeft size={22} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-none">Saved Lodges</h1>
              <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                {favoriteLodges.length} Collections <Sparkles size={10} className="fill-blue-600" />
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <AnimatePresence mode="popLayout">
          {favoriteLodges.length > 0 ? (
            favoriteLodges.map((lodge, index) => {
               const isVerified = lodge.profiles?.is_verified === true;
               const hasPhone = !!lodge.profiles?.phone_number;

               const allCardImages = [
                 ...lodge.image_urls,
                 ...(lodge.units?.flatMap(u => u.image_urls || []).filter(Boolean) || [])
               ].slice(0, 10);

               return (
                <motion.div 
                  key={lodge.id} 
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-[40px] overflow-hidden shadow-sm border border-gray-100 relative group"
                >
                  <div className="relative h-64 xs:h-72 w-full bg-gray-100 group">
                    <div className="flex h-full overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar">
                      {allCardImages.map((img, idx) => (
                        <div key={idx} className="w-full h-full shrink-0 snap-start relative">
                          <Link href={`/lodge/${lodge.id}`}>
                            <Image 
                              src={img} 
                              alt={lodge.title}
                              fill
                              priority={idx === 0}
                              className="object-cover group-active:scale-105 transition-transform duration-700"
                            />
                          </Link>
                        </div>
                      ))}
                    </div>

                    {allCardImages.length > 1 && (
                      <div className="absolute top-5 left-5 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-xl text-white text-[9px] font-black tracking-widest uppercase pointer-events-none border border-white/10">
                        {allCardImages.length} Photos
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      toggleFavorite(lodge.id);
                    }}
                    className="absolute top-5 right-5 p-3.5 rounded-2xl shadow-xl bg-red-500 text-white active:scale-75 transition-all border border-red-400"
                  >
                    <Heart size={20} fill="currentColor" />
                  </button>
                  
                  <div className="p-6 xs:p-8">
                    <Link href={`/lodge/${lodge.id}`}>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <div className="px-3 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded-xl uppercase tracking-widest border border-blue-100">
                          {lodge.location}
                        </div>
                        {lodge.promoted_until && new Date(lodge.promoted_until) > new Date() && (
                          <div className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-600 text-[10px] font-black rounded-xl uppercase tracking-widest border border-amber-100">
                            <Zap size={12} className="fill-amber-600" /> Featured
                          </div>
                        )}
                        {isVerified && (
                          <div className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 text-[10px] font-black rounded-xl uppercase tracking-widest border border-green-100">
                            <CheckCircle size={12} className="fill-green-600/20" /> Verified
                          </div>
                        )}
                        {lodge.landlord_z_score !== undefined && (
                          <div className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-black rounded-xl uppercase tracking-widest border ${
                            lodge.landlord_z_score >= 80 ? 'bg-blue-50 text-blue-700 border-blue-100' : lodge.landlord_z_score >= 50 ? 'bg-gray-50 text-gray-600 border-gray-100' : 'bg-red-50 text-red-600 border-red-100'
                          }`}>
                            <ShieldCheck size={12} /> Score: {lodge.landlord_z_score}
                          </div>
                        )}
                        
                        {(() => {
                          const totalAvailable = lodge.units?.reduce((acc, u) => acc + u.available_units, 0) || 0;
                          if (totalAvailable > 0 && totalAvailable <= 2) {
                            return (
                              <div className="px-3 py-1.5 bg-red-50 text-red-600 text-[10px] font-black rounded-xl uppercase tracking-widest animate-pulse border border-red-100">
                                Only {totalAvailable} left!
                              </div>
                            );
                          }
                          if (totalAvailable === 0 && lodge.units && lodge.units.length > 0) {
                            return (
                              <div className="px-3 py-1.5 bg-gray-100 text-gray-500 text-[10px] font-black rounded-xl uppercase tracking-widest border border-gray-200">
                                Fully Booked
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-black text-xl text-gray-900 tracking-tight leading-tight group-hover:text-blue-600 transition-colors">{lodge.title}</h3>
                        <div className="text-right shrink-0 ml-4">
                          <div className="text-blue-600 font-black text-lg leading-none">
                            {lodge.units && lodge.units.length > 0 ? (
                              (() => {
                                const prices = lodge.units.map(u => u.price);
                                return `₦${Math.min(...prices).toLocaleString()}`;
                              })()
                            ) : (
                              `₦${lodge.price.toLocaleString()}`
                            )}
                          </div>
                          <div className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-1">Per Year</div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mb-6 line-clamp-2 leading-relaxed font-medium">{lodge.description}</p>
                    </Link>
                    
                    {lodge.units && lodge.units.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-8">
                        {Array.from(new Set(lodge.units.map(u => u.name))).slice(0, 3).map(name => (
                          <span key={name} className="px-3 py-1.5 bg-gray-50 text-gray-600 text-[10px] font-black uppercase tracking-tighter rounded-xl border border-gray-100">
                            {name}
                          </span>
                        ))}
                        {new Set(lodge.units.map(u => u.name)).size > 3 && (
                          <span className="px-3 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-tighter rounded-xl border border-blue-100">
                            +{new Set(lodge.units.map(u => u.name)).size - 3} More
                          </span>
                        )}
                      </div>
                    )}
                    
                    {hasPhone ? (
                      <div className="flex gap-3">
                        {studentLeads[lodge.id]?.status === 'unlocked' ? (
                          <>
                            <button 
                              className="flex-1 flex items-center justify-center gap-2 py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-transform"
                              onClick={() => window.location.href = `tel:${studentLeads[lodge.id].phone}`}
                            >
                              <Phone size={18} />
                              <span className="uppercase tracking-widest text-[10px] font-black">Call</span>
                            </button>
                            <button 
                              className="flex-1 flex items-center justify-center gap-2 py-4 bg-green-600 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-transform"
                              onClick={() => {
                                window.open(`https://wa.me/234${studentLeads[lodge.id].phone?.substring(1)}?text=Hello, I am interested in ${lodge.title} (from favorites)`);
                              }}
                            >
                              <MessageCircle size={18} />
                              <span className="uppercase tracking-widest text-[10px] font-black">WhatsApp</span>
                            </button>
                          </>
                        ) : studentLeads[lodge.id]?.status === 'pending' ? (
                          <button 
                            disabled 
                            className="w-full py-4 bg-gray-100 text-gray-400 rounded-2xl font-bold flex items-center justify-center gap-2 cursor-not-allowed text-[10px] uppercase tracking-widest"
                          >
                            <CheckCircle size={16} /> Request Sent
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleRequestChat(lodge.id)}
                            disabled={requestingId === lodge.id}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-blue-200 active:scale-95 transition-transform text-[10px] uppercase tracking-widest"
                          >
                            {requestingId === lodge.id ? <Loader2 className="animate-spin" size={16} /> : <MessageCircle size={16} />}
                            Request Chat
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="py-4 px-6 bg-gray-50 rounded-2xl text-center text-[10px] text-gray-400 font-black uppercase tracking-widest italic border border-dashed border-gray-200">
                        Contact details not provided
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[40px] border border-gray-100 shadow-sm"
            >
              <div className="w-24 h-24 bg-gray-50 rounded-[32px] flex items-center justify-center mb-8 text-gray-300 border-4 border-white shadow-inner">
                <Heart size={48} className="fill-gray-100" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-2">No Saved Lodges</h2>
              <p className="text-gray-500 max-w-[250px] font-medium leading-relaxed mb-10">
                Lodges you save will appear here. Start exploring to find your next home!
              </p>
              <Link href="/" className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 active:scale-95 transition-all hover:bg-blue-700">
                Explore Lodges
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}