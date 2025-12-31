'use client';

import { useAppContext } from '@/lib/context';
import { useData } from '@/lib/data-context';
import { LodgeSkeleton } from '@/components/Skeleton';
import { MapPin, Phone, MessageCircle, Heart, ChevronLeft, CheckCircle, Loader2, Sparkles, Building2, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Lodge } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function FavoritesPage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useAppContext();
  const { lodges, favorites, toggleFavorite, isLoading: isDataLoading } = useData();
  const [loadingCallId, setLoadingCallId] = useState<string | null>(null);
  const [loadingMsgId, setLoadingMsgId] = useState<string | null>(null);

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

  const handleCall = async (lodge: Lodge) => {
    setLoadingCallId(lodge.id);
    if (user) {
      try {
        await supabase.from('notifications').insert({
          user_id: lodge.landlord_id,
          type: 'info',
          link: `/lodge/${lodge.id}`
        });
      } catch (err: unknown) { 
        console.error('Failed to notify landlord of call:', err);
        toast.error('Could not send notification to landlord');
      }
    }
    await new Promise(r => setTimeout(r, 600));
    window.location.href = `tel:${lodge.profiles?.phone_number}`;
    setTimeout(() => setLoadingCallId(null), 2000);
  };

  const handleWhatsApp = async (lodge: Lodge) => {
    setLoadingMsgId(lodge.id);
    if (user) {
      try {
        await supabase.from('notifications').insert({
          user_id: lodge.landlord_id,
          title: 'WhatsApp Inquiry! 💬',
          message: `A student clicked to message you about "${lodge.title}" (Favorites).`,
          type: 'info',
          link: `/lodge/${lodge.id}`
        });
      } catch (err: unknown) { 
        console.error('Failed to notify landlord of WhatsApp inquiry:', err);
        toast.error('Could not send notification to landlord');
      }
    }
    await new Promise(r => setTimeout(r, 600));
    window.open(`https://wa.me/234${lodge.profiles?.phone_number?.substring(1)}?text=Hello, I am interested in ${lodge.title}`);
    setTimeout(() => setLoadingMsgId(null), 2000);
  };

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
                        <div key={idx} className="w-full h-full shrink-0 snap-start">
                          <Link href={`/lodge/${lodge.id}`}>
                            <img 
                              src={img} 
                              alt={lodge.title}
                              loading={idx === 0 ? "eager" : "lazy"}
                              className="w-full h-full object-cover group-active:scale-105 transition-transform duration-700"
                            />
                          </Link>
                        </div>
                      ))}
                    </div>

                    <div className="absolute bottom-5 left-5 flex flex-col gap-2 pointer-events-none">
                      <div className="flex gap-2">
                        <div className="px-3 py-1.5 bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg">
                          {lodge.location}
                        </div>
                        {isVerified && (
                          <div className="flex items-center gap-1 px-3 py-1.5 bg-green-500/90 backdrop-blur-md text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg">
                            <CheckCircle size={12} className="fill-white/20" /> Verified
                          </div>
                        )}
                      </div>
                      
                      {(() => {
                        const totalAvailable = lodge.units?.reduce((acc, u) => acc + u.available_units, 0) || 0;
                        if (totalAvailable > 0 && totalAvailable <= 2) {
                          return (
                            <div className="px-3 py-1.5 bg-red-600/90 backdrop-blur-md text-white text-[10px] font-black rounded-xl uppercase tracking-widest animate-pulse shadow-lg">
                              Only {totalAvailable} left!
                            </div>
                          );
                        }
                        if (totalAvailable === 0 && lodge.units && lodge.units.length > 0) {
                          return (
                            <div className="px-3 py-1.5 bg-gray-900/90 backdrop-blur-md text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg">
                              Fully Booked
                            </div>
                          );
                        }
                        return null;
                      })()}
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
                        <button 
                          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all ${
                            loadingCallId === lodge.id ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white shadow-xl shadow-gray-200'
                          }`}
                          disabled={loadingCallId === lodge.id}
                          onClick={() => handleCall(lodge)}
                        >
                          {loadingCallId === lodge.id ? (
                            <><Loader2 className="animate-spin" size={16} /> Connecting</>
                          ) : (
                            <><Phone size={16} /> Call Now</>
                          )}
                        </button>
                        <button 
                          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all ${
                            loadingMsgId === lodge.id ? 'bg-green-100 text-green-600' : 'bg-green-600 text-white shadow-xl shadow-green-100 hover:bg-green-700'
                          }`}
                          disabled={loadingMsgId === lodge.id}
                          onClick={() => handleWhatsApp(lodge)}
                        >
                          {loadingMsgId === lodge.id ? (
                            <><Loader2 className="animate-spin" size={16} /> Opening</>
                          ) : (
                            <><MessageCircle size={16} /> WhatsApp</>
                          )}
                        </button>
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