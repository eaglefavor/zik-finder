'use client';

import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, MapPin, ShieldCheck, Phone, MessageCircle, Info, CheckCircle2, Heart, AlertTriangle, Camera, Loader2, Share2, ChevronRight, BedDouble, Building2, Star } from 'lucide-react';
import Link from 'next/link';
import { useData } from '@/lib/data-context';
import { useAppContext } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { useState, useEffect, useMemo, useRef } from 'react';
import { LodgeUnit } from '@/lib/types';
import { toast } from 'sonner';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import dynamic from 'next/dynamic';
import Image from 'next/image';

const ReviewModal = dynamic(() => import('@/components/ReviewModal'), { ssr: false });
const ReportModal = dynamic(() => import('@/components/ReportModal'), { ssr: false });

import { useLodgeViewTracker } from '@/lib/useLodgeViewTracker';

// Variants for the slide animation
const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 1000 : -1000,
    opacity: 0
  })
};

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

export default function LodgeDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { lodges, favorites, toggleFavorite } = useData();
  const { user } = useAppContext();
  
  // Carousel State
  const [[page, direction], setPage] = useState([0, 0]);
  const [selectedUnit, setSelectedUnit] = useState<LodgeUnit | null>(null);
  
  const [leadStatus, setLeadStatus] = useState<'none' | 'pending' | 'unlocked'>('none');
  const [contactInfo, setContactInfo] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingHistory] = useState(false);
  
  const lodge = lodges.find(l => l.id === id);
  const galleryRef = useRef<HTMLDivElement>(null);

  // Fetch Reviews
  const fetchReviews = async () => {
    if (!id) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from('reviews')
      .select('*, profiles(name, avatar_url)')
      .eq('lodge_id', id)
      .order('created_at', { ascending: false });
    
    if (data) setReviews(data);
    setLoadingHistory(false);
  };

  useEffect(() => {
    fetchReviews();
  }, [id]);

  // Check Lead Status
  useEffect(() => {
    if (!user || !lodge) return;

    const checkStatus = async () => {
      // Check if unlocked or pending
      const { data } = await supabase
        .from('leads')
        .select('status')
        .eq('student_id', user.id)
        .eq('lodge_id', lodge.id)
        .eq('type', 'inbound')
        .maybeSingle();

      if (data) {
        setLeadStatus(data.status as 'pending' | 'unlocked');
        if (data.status === 'unlocked') {
           // Fetch contact info separately if unlocked? 
           // Ideally, RLS allows reading profile if unlocked.
           // For now, we use the profile data already attached to lodge if available, 
           // BUT the sanitizer stripped it from description/title. 
           // The phone_number column in profile IS NOT sanitized.
           // However, the `lodges` query in `data-context` might not be selecting it securely?
           // `get_lodges_feed` joins profiles. 
           // We need to ensure the phone number is HIDDEN in `get_lodges_feed` unless unlocked?
           // Actually, `profiles` table has `phone_number`. RLS usually protects it?
           // We need to check RLS on profiles.
           setContactInfo(lodge.profiles?.phone_number || null);
        }
      }
    };
    
    checkStatus();
  }, [user, lodge]);

  const handleRequestChat = async () => {
    if (!user) {
      toast.error("Please log in to contact landlords");
      router.push('/onboarding'); // Or auth screen
      return;
    }
    
    setRequesting(true);
    try {
      const { data, error } = await supabase.rpc('create_inbound_lead', {
        p_lodge_id: lodge?.id
      });

      if (error) throw error;
      if (data.success) {
        setLeadStatus('pending');
        toast.success("Request sent! You'll be notified when the landlord accepts.");
      } else {
        toast.error(data.message);
      }
    } catch (err: unknown) {
      toast.error('Failed to send request');
      console.error(err);
    } finally {
      setRequesting(false);
    }
  };
  if (lodge?.units && lodge.units.length > 0 && !selectedUnit) {
    const firstAvailable = lodge.units.find(u => u.available_units > 0) || lodge.units[0];
    setSelectedUnit(firstAvailable);
  }

  useLodgeViewTracker(id as string);

  // SMART IMAGE ORDERING & METADATA
  const galleryImages = useMemo(() => {
    if (!lodge) return [];

    const images: { url: string; type: 'unit' | 'building'; label: string }[] = [];

    // A. Unit Images (Priority)
    if (selectedUnit?.image_urls) {
      selectedUnit.image_urls.forEach(url => {
        images.push({ url, type: 'unit', label: selectedUnit.name });
      });
    }

    // B. Building Images
    if (lodge.image_urls) {
      lodge.image_urls.forEach(url => {
        if (!images.find(img => img.url === url)) {
          images.push({ url, type: 'building', label: 'Main Building' });
        }
      });
    }

    return images;
  }, [lodge, selectedUnit]);

  const imageIndex = Math.abs(page % galleryImages.length);
  const currentImage = galleryImages[galleryImages.length > 0 ? imageIndex : 0];

  const paginate = (newDirection: number) => {
    setPage([page + newDirection, newDirection]);
  };

  if (!lodge) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        <h1 className="text-xl font-bold">Lodge not found</h1>
        <Link href="/" className="text-blue-600 underline">Go back home</Link>
      </div>
    );
  }

  const isFavorite = favorites.includes(lodge.id);
  const displayPrice = selectedUnit ? selectedUnit.price : lodge.price;

  const handleShare = async () => {
    const shareData = {
      title: lodge.title,
      text: `Check out this lodge on ZikLodge: ${lodge.title} in ${lodge.location}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  return (
    <div className="pb-32 bg-gray-50 min-h-screen">
      {/* PREMIUM CAROUSEL HEADER */}
      <div className="relative h-[60vh] bg-gray-900 overflow-hidden" ref={galleryRef}>
        <AnimatePresence initial={false} custom={direction}>
          {galleryImages.length > 0 ? (
            <motion.img
              key={page}
              src={currentImage?.url}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={1}
              onDragEnd={(e, { offset, velocity }: PanInfo) => {
                const swipe = swipePower(offset.x, velocity.x);
                if (swipe < -swipeConfidenceThreshold) {
                  paginate(1);
                } else if (swipe > swipeConfidenceThreshold) {
                  paginate(-1);
                }
              }}
              className="absolute w-full h-full object-cover"
              alt={currentImage?.label || lodge.title}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              No images available
            </div>
          )}
        </AnimatePresence>

        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none" />

        <div className="absolute top-0 left-0 right-0 p-4 pt-6 flex justify-between items-center z-20">
          <button 
            onClick={() => router.back()}
            className="p-3 bg-white/20 backdrop-blur-xl rounded-full text-white hover:bg-white/30 transition-colors active:scale-90 shadow-lg"
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="flex gap-3">
            <button 
              onClick={handleShare}
              className="p-3 bg-white/20 backdrop-blur-xl rounded-full text-white hover:bg-white/30 transition-colors active:scale-90 shadow-lg"
            >
              <Share2 size={22} />
            </button>
            <button 
              onClick={() => toggleFavorite(lodge.id)}
              className={`p-3 rounded-full shadow-lg active:scale-90 transition-all ${
                isFavorite ? 'bg-red-500 text-white' : 'bg-white/20 backdrop-blur-xl text-white hover:bg-white/30'
              }`}
            >
              <Heart size={22} fill={isFavorite ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        {galleryImages.length > 0 && (
          <div className="absolute bottom-6 left-4 z-20 flex flex-col gap-2">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10 shadow-sm ${
              currentImage?.type === 'unit' ? 'bg-blue-600/90 text-white' : 'bg-gray-900/60 text-gray-200'
            }`}>
              {currentImage?.type === 'unit' ? <BedDouble size={14} /> : <Building2 size={14} />}
              <span className="text-xs font-black uppercase tracking-wide">
                {currentImage?.label}
              </span>
            </div>
            
            <div className="text-[10px] text-white/80 font-mono bg-black/40 px-2 py-0.5 rounded-md w-fit">
              {imageIndex + 1} / {galleryImages.length}
            </div>
          </div>
        )}

        {galleryImages.length > 1 && (
          <>
            <button className="absolute top-1/2 left-4 -translate-y-1/2 p-2 rounded-full bg-black/20 text-white/70 hover:bg-black/40 hidden md:block z-10" onClick={() => paginate(-1)}>
              <ChevronLeft size={32} />
            </button>
            <button className="absolute top-1/2 right-4 -translate-y-1/2 p-2 rounded-full bg-black/20 text-white/70 hover:bg-black/40 hidden md:block z-10" onClick={() => paginate(1)}>
              <ChevronRight size={32} />
            </button>
          </>
        )}
      </div>

      <div className="px-5 py-8 -mt-10 bg-gray-50 rounded-t-[40px] relative z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] min-h-[50vh]">
        
        {/* Verification Status Banner */}
        {!lodge.profiles?.is_verified ? (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex gap-3 items-start shadow-sm">
            <AlertTriangle className="text-orange-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="text-sm font-black text-orange-900 uppercase tracking-tight">Unverified Landlord</h3>
              <p className="text-xs text-orange-800 mt-1 leading-relaxed font-medium">
                Please verify this lodge physically before making any payments. Do not transfer money in advance.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full shadow-sm">
            <ShieldCheck className="text-green-600" size={16} />
            <span className="text-xs font-black text-green-800 uppercase tracking-wide">Verified Landlord</span>
          </div>
        )}

        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0 pr-4">
            <h1 className="text-3xl font-black text-gray-900 leading-none mb-3">
              {lodge.title}
            </h1>
            <div className="flex items-center gap-2 text-gray-500 bg-white w-fit px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm">
              <MapPin size={16} className="text-blue-500 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wide truncate">{lodge.location}{lodge.landmark ? `, near ${lodge.landmark}` : ''}</span>
            </div>
          </div>
        </div>

        {/* Pricing Block */}
        <div className="mb-8 py-6 border-b border-gray-200">
          <div className="flex items-end gap-2">
            <div className="text-5xl font-black text-blue-600 tracking-tighter">
              {!selectedUnit && lodge.units && lodge.units.length > 1 ? (
                `From ₦${Math.min(...lodge.units.map(u => u.price)).toLocaleString()}`
              ) : (
                `₦${displayPrice.toLocaleString()}`
              )}
            </div>
            <div className="text-sm text-gray-400 font-black uppercase mb-2 tracking-widest">/ Year</div>
          </div>
        </div>

        {/* Room Types Section */}
        {lodge.units && lodge.units.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-black text-gray-900 mb-5 flex items-center gap-2 uppercase tracking-tight">
              <BedDouble size={20} className="text-blue-500" />
              Available Rooms
            </h2>
            <div className="space-y-4">
              {lodge.units.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => {
                    setSelectedUnit(unit);
                    setPage([0, 0]); 
                  }}
                  className={`w-full text-left p-1 rounded-[28px] transition-all duration-300 relative group ${
                    selectedUnit?.id === unit.id 
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-xl shadow-blue-200 scale-[1.02]' 
                      : 'bg-white shadow-sm hover:shadow-md border border-gray-100'
                  }`}
                >
                  <div className={`p-5 rounded-[26px] h-full ${
                    selectedUnit?.id === unit.id ? 'bg-white/10 backdrop-blur-sm' : 'bg-white'
                  }`}>
                    <div className="flex items-start justify-between relative z-10">
                      <div className="flex items-center gap-4">
                        {/* Selection Indicator */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-inner ${
                          selectedUnit?.id === unit.id ? 'bg-white text-blue-600' : 'bg-gray-100 text-gray-300'
                        }`}>
                           <CheckCircle2 size={20} className={selectedUnit?.id === unit.id ? 'opacity-100' : 'opacity-0'} />
                        </div>

                        <div>
                          <h3 className={`font-black text-lg ${selectedUnit?.id === unit.id ? 'text-white' : 'text-gray-900'}`}>
                            {unit.name}
                          </h3>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {unit.available_units > 0 ? (
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${
                                selectedUnit?.id === unit.id ? 'bg-white/20 text-white' : 'bg-green-50 text-green-700'
                              }`}>
                                {unit.available_units} Left
                              </span>
                            ) : (
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-gray-100 text-gray-500">
                                Sold Out
                              </span>
                            )}
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${
                                selectedUnit?.id === unit.id ? 'bg-white/20 text-white' : 'bg-gray-50 text-gray-500 border border-gray-100'
                            }`}>
                               ₦{unit.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Action: View Photos */}
                    {selectedUnit?.id === unit.id && unit.image_urls && unit.image_urls.length > 0 && (
                       <div className="mt-4 pl-12">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest bg-white px-4 py-2.5 rounded-xl shadow-lg active:scale-95 transition-transform"
                          >
                            <Camera size={14} /> View Photos
                          </button>
                       </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mb-10">
          <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-tight">
            <Info size={20} className="text-blue-500" /> 
            About this Lodge
          </h2>
          <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
            <p className="text-gray-600 leading-relaxed text-sm whitespace-pre-wrap font-medium">
              {lodge.description}
            </p>
          </div>

          {leadStatus === 'unlocked' && (
            <button 
              onClick={() => setShowReviewModal(true)}
              className="mt-4 w-full py-3 bg-amber-50 text-amber-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border border-amber-100 active:scale-95 transition-all"
            >
              <Star size={16} /> Rate & Review this Landlord
            </button>
          )}
        </section>

        {/* Reviews Section */}
        <section className="mb-10">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2 uppercase tracking-tight">
              <Star size={20} className="text-amber-500 fill-amber-500" />
              Student Reviews
            </h2>
            <Link href={`/lodge/${id}/reviews`} className="text-xs font-bold text-blue-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-4">
            {loadingReviews ? (
              <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-gray-300" /></div>
            ) : reviews.length === 0 ? (
              <div className="bg-white p-8 rounded-[32px] border border-dashed border-gray-200 text-center">
                <p className="text-gray-400 font-medium text-sm">No reviews yet. Be the first to rate!</p>
              </div>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden relative border border-gray-100">
                        {review.profiles?.avatar_url ? (
                          <Image src={review.profiles.avatar_url} fill className="object-cover" alt="" />
                        ) : (
                          <span className="text-[10px] font-bold text-gray-400">{(review.profiles?.name || 'U')[0]}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-900">{review.profiles?.name || 'Student'}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(review.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={10} className={review.rating >= s ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-gray-600 font-medium leading-relaxed italic border-l-2 border-gray-100 pl-3">
                      &quot;{review.comment}&quot;
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mb-24">
          <h2 className="text-lg font-black text-gray-900 mb-4 uppercase tracking-tight">Amenities</h2>
          <div className="grid grid-cols-2 gap-3">
            {lodge.amenities.map((item) => (
              <div key={item} className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <CheckCircle2 size={18} />
                </div>
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{item}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-center mt-8 mb-20">
          <button 
            onClick={() => setShowReportModal(true)}
            className="text-red-400 text-xs font-bold uppercase tracking-widest hover:text-red-600 transition-colors flex items-center gap-2"
          >
            <AlertTriangle size={14} /> Report Listing
          </button>
        </div>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-50 flex gap-3 pb-8 xs:pb-4 shadow-2xl">
        {leadStatus === 'unlocked' && contactInfo ? (
          <>
            <button 
              className="flex-1 flex items-center justify-center gap-2 py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-transform group"
              onClick={() => window.location.href = `tel:${contactInfo}`}
            >
              <Phone size={20} className="group-hover:rotate-12 transition-transform" />
              <span className="uppercase tracking-widest text-xs font-black">Call</span>
            </button>

            <button 
              className="flex-[1.5] flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-bold shadow-xl shadow-green-200 active:scale-95 transition-transform group"
              onClick={() => {
                const message = selectedUnit 
                  ? `I am interested in the ${selectedUnit.name} at ${lodge.title} (₦${selectedUnit.price.toLocaleString()})`
                  : `I am interested in ${lodge.title}`;
                window.open(`https://wa.me/234${contactInfo.substring(1)}?text=${encodeURIComponent(message)}`);
              }}
            >
              <MessageCircle size={20} className="group-hover:scale-110 transition-transform" />
              <span className="uppercase tracking-widest text-xs font-black">WhatsApp</span>
            </button>
          </>
        ) : leadStatus === 'pending' ? (
          <button 
            disabled 
            className="w-full py-4 bg-gray-100 text-gray-400 rounded-2xl font-bold flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <CheckCircle2 size={20} /> Request Sent (Pending Landlord)
          </button>
        ) : (
          <button 
            onClick={handleRequestChat}
            disabled={requesting}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-blue-200 active:scale-95 transition-transform"
          >
            {requesting ? <Loader2 className="animate-spin" size={20} /> : <MessageCircle size={20} />}
            Request Chat (Secure)
          </button>
        )}
      </div>

      {showReviewModal && (
        <ReviewModal 
          lodgeId={lodge.id} 
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => {
            setShowReviewModal(false);
            fetchReviews();
          }}
        />
      )}

      {showReportModal && (
        <ReportModal 
          lodgeId={lodge.id}
          landlordId={lodge.landlord_id}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}
