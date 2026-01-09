'use client';

import { useAppContext } from '@/lib/context';
import { useData } from '@/lib/data-context';
import { ShieldCheck, Bell, PlusCircle, Trash2, Edit3, X, CheckCircle, Eye, MapPin, Heart, Phone, MessageCircle, Loader2, Sparkles, Building2, TrendingUp, TrendingDown, Minus, Activity, LayoutGrid, ChevronRight, Search, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import AuthScreen from '@/components/AuthScreen';
import { Lodge } from '@/lib/types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

const PaymentModal = dynamic(() => import('@/components/PaymentModal'), { ssr: false });

const AdminLink = ({ role }: { role: string }) => (
  role === 'admin' ? (
    <Link href="/admin" className="block mb-6 bg-gray-900 text-white p-5 rounded-3xl shadow-xl shadow-gray-200 relative overflow-hidden group">
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10">
            <ShieldCheck size={24} className="text-blue-400" />
          </div>
          <div>
            <div className="font-black tracking-tight text-lg leading-none">Admin Dashboard</div>
            <div className="text-[10px] text-white/50 uppercase font-black tracking-widest mt-1.5">System Control Center</div>
          </div>
        </div>
        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-blue-600 transition-colors duration-300">
          <ChevronRight size={20} />
        </div>
      </div>
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />
    </Link>
  ) : null
);

export default function Home() {
  const { user, role, isLoading: authLoading } = useAppContext();
  const { 
    lodges, 
    deleteLodge, 
    updateLodgeStatus, 
    updateUnitAvailability, 
    toggleFavorite, 
    favorites, 
    viewGrowth,
    fetchInitialLodges,
    fetchMoreLodges,
    isLodgesLoading,
    hasMoreLodges
  } = useData();
  
  const [loadingCallId, setLoadingCallId] = useState<string | null>(null);
  const [loadingMsgId, setLoadingMsgId] = useState<string | null>(null);
  const [loadingStatusId, setLoadingStatusId] = useState<string | null>(null);
  const [promotingLodge, setPromotingLodge] = useState<Lodge | null>(null);

  const handlePromoteSuccess = async (reference: string) => {
    if (!promotingLodge) return;

    try {
      const { data, error } = await supabase.rpc('promote_lodge', {
        p_lodge_id: promotingLodge.id,
        p_payment_reference: reference
      });

      if (error) throw error;

      toast.success('Lodge promoted successfully!', {
        description: 'Your listing is now at the top of the feed for 7 days.'
      });
      
      // Refresh lodges to show the new status
      await fetchInitialLodges();
    } catch (err: unknown) {
      console.error('Promotion error:', err);
      toast.error('Failed to activate promotion. Please contact support.');
    } finally {
      setPromotingLodge(null);
    }
  };

  // Infinite Scroll Logic
  const observer = useRef<IntersectionObserver | null>(null);
  const lastLodgeRef = useCallback((node: HTMLDivElement) => {
    if (isLodgesLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreLodges) {
        fetchMoreLodges();
      }
    });
    if (node) observer.current.observe(node);
  }, [isLodgesLoading, hasMoreLodges, fetchMoreLodges]);

  if (authLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-gray-400 font-black text-[10px] uppercase tracking-[0.2em] animate-pulse">Initializing ZikLodge</p>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    toast.error('Delete this listing?', {
      description: 'This action is permanent and cannot be undone.',
      action: {
        label: 'Delete Forever',
        onClick: async () => {
          await deleteLodge(id);
          toast.success('Listing removed');
        }
      }
    });
  };

  const handleCall = async (lodge: Lodge) => {
    setLoadingCallId(lodge.id);
    if (user) {
      try {
        await supabase.rpc('send_lodge_inquiry', {
          p_lodge_id: lodge.id,
          p_inquiry_type: 'call'
        });
      } catch (err: unknown) { 
        console.error('Failed to notify landlord of call:', err);
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
        await supabase.rpc('send_lodge_inquiry', {
          p_lodge_id: lodge.id,
          p_inquiry_type: 'whatsapp'
        });
      } catch (err: unknown) { 
        console.error('Failed to notify landlord of WhatsApp inquiry:', err);
      }
    }
    await new Promise(r => setTimeout(r, 600));
    window.open(`https://wa.me/234${lodge.profiles?.phone_number?.substring(1)}?text=Hello, I am interested in ${lodge.title}`);
    setTimeout(() => setLoadingMsgId(null), 2000);
  };

  const handleStatusUpdate = async (id: string, currentStatus: string) => {
    setLoadingStatusId(id);
    await updateLodgeStatus(id, currentStatus === 'available' ? 'taken' : 'available');
    setTimeout(() => setLoadingStatusId(null), 500);
  };

  if (role === 'landlord') {
    const landlordLodges = lodges.filter(l => l.landlord_id === user.id);
    const totalViews = landlordLodges.reduce((acc, curr) => acc + (curr.views || 0), 0);

    return (
      <div className="min-h-screen bg-gray-50/50 pb-24">
        {/* Premium Dashboard Header */}
        <div className="bg-white border-b border-gray-100 px-4 py-6 sticky top-0 z-30 shadow-sm shadow-gray-100/50 backdrop-blur-xl bg-white/80">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl xs:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                Activity <Activity className="text-blue-600" size={20} />
              </h1>
              <p className="text-xs xs:text-sm text-gray-500 font-medium mt-0.5">Manage your real estate portfolio</p>
            </div>
            <Link href="/profile" className="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center border-2 border-white shadow-lg shadow-blue-100 active:scale-90 transition-transform overflow-hidden relative">
              {user.avatar_url ? (
                <Image src={user.avatar_url} alt={user.name || 'User'} fill className="object-cover" />
              ) : (
                <span className="font-black text-blue-600 text-lg">{(user.name || 'L')[0]}</span>
              )}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <motion.div 
              whileHover={{ y: -2 }}
              className="bg-gradient-to-br from-blue-600 to-blue-700 p-4 rounded-[24px] text-white shadow-xl shadow-blue-200 relative overflow-hidden"
            >
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3 opacity-80">
                  <Eye size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Total Views</span>
                </div>
                <div className="text-2xl font-black">{totalViews.toLocaleString()}</div>
                <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold ${
                  viewGrowth > 0 ? 'text-green-300' : viewGrowth < 0 ? 'text-red-300' : 'text-blue-100'
                }`}>
                  {viewGrowth > 0 ? <TrendingUp size={10} /> : viewGrowth < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                  {viewGrowth > 0 ? '+' : ''}{viewGrowth}% this week
                </div>
              </div>
              <Activity className="absolute -bottom-4 -right-4 w-20 h-20 text-white/10 -rotate-12" />
            </motion.div>

            <Link href="/profile/notifications">
              <motion.div 
                whileHover={{ y: -2 }}
                className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm active:scale-95 transition-all h-full"
              >
                <div className="flex items-center gap-2 mb-3 text-orange-500">
                  <Bell size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Live Feed</span>
                </div>
                <div className="text-2xl font-black text-gray-900">Leads</div>
                <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">Check Notifications</div>
              </motion.div>
            </Link>
          </div>
        </div>

        <div className="px-4 py-8 space-y-8">
          <AdminLink role={role} />

          <div className="flex justify-between items-end mb-2">
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Your Properties</h2>
              <p className="text-xs text-gray-400 font-medium">Active listings on ZikLodge</p>
            </div>
            <Link 
              href="/post" 
              className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all"
            >
              <PlusCircle size={14} /> New Lodge
            </Link>
          </div>

          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {landlordLodges.length > 0 ? (
                landlordLodges.map((lodge, index) => (
                  <motion.div 
                    key={lodge.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white p-5 xs:p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-6 relative overflow-hidden group"
                  >
                    <div className="flex gap-4 xs:gap-6">
                      <div className="w-20 h-20 xs:w-24 xs:h-24 rounded-2xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100 shadow-inner relative">
                        <Image src={lodge.image_urls[0]} fill className="object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex justify-between items-start">
                          <h3 className="font-black text-gray-900 truncate pr-2 text-lg leading-tight">{lodge.title}</h3>
                          <button 
                            onClick={(e) => handleDelete(e, lodge.id)}
                            className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all active:scale-90"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <div className="text-blue-600 font-black text-sm mt-1">
                          {lodge.units && lodge.units.length > 0 ? (
                            `From ₦${Math.min(...lodge.units.map(u => u.price)).toLocaleString()}`
                          ) : (
                            `₦${lodge.price.toLocaleString()}`
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                          <div className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                            lodge.status === 'available' ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600'
                          }`}>
                            {lodge.status === 'available' ? 'Public' : 'Hidden'}
                          </div>
                          <div className="flex items-center gap-1 text-gray-400">
                            <Eye size={12} className="text-blue-400" />
                            <span className="text-[10px] font-black">{lodge.views?.toLocaleString() || 0} Views</span>
                          </div>
                          {lodge.promoted_until && new Date(lodge.promoted_until) > new Date() && (
                            <div className="flex items-center gap-1 text-amber-500">
                              <Zap size={12} className="fill-amber-500" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Featured</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {lodge.units && lodge.units.length > 0 && (
                      <div className="bg-gray-50/50 rounded-3xl p-4 space-y-3 border border-gray-100/50">
                        <div className="flex justify-between items-center px-1">
                          <div className="flex items-center gap-2">
                            <LayoutGrid size={12} className="text-gray-400" />
                            <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Inventory Status</h4>
                          </div>
                          <span className="text-[9px] font-bold text-gray-400">Avail / Total</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {lodge.units.map((unit) => (
                            <div key={unit.id} className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-gray-50 group/unit">
                              <div className="min-w-0 pr-2">
                                <p className="text-[10px] font-black text-gray-900 truncate uppercase tracking-tighter">{unit.name}</p>
                                <p className="text-[9px] text-blue-600 font-bold">₦{unit.price.toLocaleString()}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateUnitAvailability(unit.id, Math.max(0, unit.available_units - 1))} className="w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-600 transition-colors active:scale-90">-</button>
                                <div className="text-center min-w-[35px]"><span className={`text-xs font-black ${unit.available_units === 0 ? 'text-red-500' : 'text-gray-900'}`}>{unit.available_units}</span><span className="text-[9px] text-gray-300 font-bold">/{unit.total_units}</span></div>
                                <button onClick={() => updateUnitAvailability(unit.id, Math.min(unit.total_units, unit.available_units + 1))} className="w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-green-50 rounded-xl text-gray-400 hover:text-green-600 transition-colors active:scale-90">+</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Link href={`/edit-lodge/${lodge.id}`} className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-4 bg-gray-50 text-gray-700 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all hover:bg-gray-100 border border-gray-100">
                        <Edit3 size={14} /> Edit
                      </Link>
                      
                      <button 
                        onClick={() => handleStatusUpdate(lodge.id, lodge.status)} 
                        disabled={loadingStatusId === lodge.id} 
                        className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all ${loadingStatusId === lodge.id ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : lodge.status === 'available' ? 'bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100' : 'bg-blue-600 text-white shadow-xl shadow-blue-200 hover:bg-blue-700'}`}
                      >
                        {loadingStatusId === lodge.id ? <><Loader2 className="animate-spin" size={14} /> ...</> : lodge.status === 'available' ? <><X size={14} /> Hide</> : <><CheckCircle size={14} /> Show</>}
                      </button>

                      <button 
                        onClick={() => setPromotingLodge(lodge)}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-100 active:scale-[0.98] transition-all"
                      >
                        <Zap size={14} className="fill-white" /> 
                        {lodge.promoted_until && new Date(lodge.promoted_until) > new Date() ? 'Extend Promotion (₦1,000)' : 'Boost Listing (₦1,000)'}
                      </button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-gray-100">
                  <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-gray-300"><Building2 size={40} /></div>
                  <p className="text-gray-500 font-bold mb-6">You haven&apos;t posted any lodges yet.</p>
                  <Link href="/post" className="inline-block bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 active:scale-95 transition-all">Create Your First Listing</Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // Student/General View
  return (
    <div className="min-h-screen bg-gray-50/50 pb-24">
      {/* Premium Search Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-6 sticky top-0 z-30 shadow-sm shadow-gray-100/50 backdrop-blur-xl bg-white/80">
        <AdminLink role={role} />
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl xs:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              Explore <Sparkles className="text-blue-500 fill-blue-500" size={20} />
            </h1>
            <p className="text-xs xs:text-sm text-gray-500 font-medium mt-0.5">Find your perfect lodge in Awka</p>
          </div>
          <Link href="/profile" className="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center border-2 border-white shadow-lg shadow-blue-100 active:scale-90 transition-transform overflow-hidden relative">
            {user.avatar_url ? (
              <Image src={user.avatar_url} alt={user.name || 'User'} fill className="object-cover" />
            ) : (
              <span className="font-black text-blue-600 text-lg">{(user.name || 'S')[0]}</span>
            )}
          </Link>
        </div>

        <Link href="/search" className="block relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors" size={18} />
          <div className="w-full bg-gray-50 border border-gray-100 p-4 pl-12 rounded-2xl text-gray-400 text-sm font-medium transition-all group-hover:bg-white group-hover:border-blue-500/30 group-hover:ring-4 group-hover:ring-blue-500/5">
            Search Ifite, Amansea, Okpuno...
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-1.5 rounded-lg">
            <LayoutGrid size={14} />
          </div>
        </Link>
      </div>

      <div className="px-4 py-8 space-y-8">
          {lodges.filter(l => l.status === 'available').map((lodge, index) => {
            const isLastLodge = index === lodges.length - 1;
            const isFavorite = favorites.includes(lodge.id);
            const isVerified = lodge.profiles?.is_verified === true;
            const isPromoted = lodge.promoted_until && new Date(lodge.promoted_until) > new Date();
            const hasPhone = !!lodge.profiles?.phone_number;
            
            const allCardImages = [
              ...lodge.image_urls,
              ...(lodge.units?.flatMap(u => u.image_urls || []).filter(Boolean) || [])
            ].slice(0, 10);

            return (
              <motion.div 
                ref={isLastLodge ? lastLodgeRef : null}
                key={lodge.id} 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-white rounded-[40px] overflow-hidden shadow-sm border relative group ${
                  isPromoted ? 'border-amber-200 ring-2 ring-amber-500/10' : 'border-gray-100'
                }`}
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
                            priority={index === 0 && idx === 0} // Prioritize first image of first lodge
                            className="object-cover group-active:scale-105 transition-transform duration-700"
                          />
                        </Link>
                      </div>
                    ))}
                  </div>

                  <div className="absolute bottom-5 left-5 flex flex-col gap-2 pointer-events-none">
                    <div className="flex flex-wrap gap-2">
                      <div className="px-3 py-1.5 bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg">
                        {lodge.location}
                      </div>
                      {isPromoted && (
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 backdrop-blur-md text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg border border-white/20">
                          <Zap size={12} className="fill-white" /> Featured
                        </div>
                      )}
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
                  className={`absolute top-5 right-5 p-3.5 rounded-2xl shadow-xl active:scale-75 transition-all backdrop-blur-md border ${
                    isFavorite ? 'bg-red-500 border-red-400 text-white' : 'bg-white/80 border-white text-gray-900 hover:bg-white'
                  }`}
                >
                  <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
                </button>
                
                <div className="p-6 xs:p-8">
                  <Link href={`/lodge/${lodge.id}`}>
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-black text-xl text-gray-900 tracking-tight leading-tight group-hover:text-blue-600 transition-colors">{lodge.title}</h3>
                      <div className="text-right shrink-0 ml-4">
                        <div className="text-blue-600 font-black text-lg leading-none">
                          {lodge.units && lodge.units.length > 0 ? (
                            `₦${Math.min(...lodge.units.map(u => u.price)).toLocaleString()}`
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
                      {Array.from(new Set(lodge.units.map(u => u.name))).slice(0, 3).map((name) => (
                        <span key={name as string} className="px-3 py-1.5 bg-gray-50 text-gray-600 text-[10px] font-black uppercase tracking-tighter rounded-xl border border-gray-100">
                          {name as string}
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
          })}
      </div>
      
      {isLodgesLoading && (
        <div className="text-center py-8 flex items-center justify-center gap-2">
          <Loader2 className="animate-spin text-blue-500" size={20} />
          <span className="text-gray-400 font-bold text-sm">Loading more...</span>
        </div>
      )}

      {!isLodgesLoading && !hasMoreLodges && lodges.length > 0 && (
        <div className="text-center py-10 flex flex-col items-center justify-center gap-3">
          <Zap size={24} className="text-gray-300" />
          <p className="text-gray-400 font-bold text-sm">You&apos;ve reached the end!</p>
        </div>
      )}

      {lodges.length === 0 && !isLodgesLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 text-gray-300 border-4 border-gray-100 shadow-inner">
            <MapPin size={40} />
          </div>
          <h3 className="text-xl font-black text-gray-900">No lodges available</h3>
          <p className="text-gray-500 text-sm max-w-[220px] mt-2 leading-relaxed">We couldn&apos;t find any active listings. Check back later!</p>
        </div>
      )}

      {promotingLodge && (
        <PaymentModal
          amount={1000}
          email={user?.email || ''}
          purpose="promoted_listing"
          metadata={{ lodge_id: promotingLodge.id }}
          onSuccess={handlePromoteSuccess}
          onClose={() => setPromotingLodge(null)}
        />
      )}
    </div>
  );
}