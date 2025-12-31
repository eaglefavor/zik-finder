'use client';

import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, MapPin, ShieldCheck, Phone, MessageCircle, Info, CheckCircle2, Heart, AlertTriangle, Camera, Loader2, Share2, ChevronRight, BedDouble, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useData } from '@/lib/data-context';
import { useAppContext } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { useState, useEffect, useMemo, useRef } from 'react';
import { LodgeUnit } from '@/lib/types';
import { toast } from 'sonner';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

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
  
  const [isCalling, setIsCalling] = useState(false);
  const [isMessaging, setIsMessaging] = useState(false);
  
  const lodge = lodges.find(l => l.id === id);
  const galleryRef = useRef<HTMLDivElement>(null);

  // Auto-select first available unit
  if (lodge?.units && lodge.units.length > 0 && !selectedUnit) {
    const firstAvailable = lodge.units.find(u => u.available_units > 0) || lodge.units[0];
    setSelectedUnit(firstAvailable);
  }

  useLodgeViewTracker(id as string);

  // SMART IMAGE ORDERING & METADATA
  // 1. If a unit is selected, show its photos FIRST.
  // 2. Then show the main lodge photos (excluding duplicates if any).
  // 3. Add labels (e.g. "Standard Room", "Main Building")
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
        // Avoid adding the exact same URL twice if it exists in both lists
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
    <div className="pb-32 bg-white min-h-screen">
      {/* 
        PREMIUM CAROUSEL HEADER
        - Swipeable (Framer Motion)
        - Clear Badges (Unit vs Building) 
      */}
      <div className="relative h-[55vh] bg-gray-900 overflow-hidden" ref={galleryRef}>
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

        {/* Gradient Overlay for Text Visibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none" />

        {/* Top Controls */}
        <div className="absolute top-0 left-0 right-0 p-4 pt-6 flex justify-between items-center z-20">
          <button 
            onClick={() => router.back()}
            className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-colors active:scale-90"
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="flex gap-3">
            <button 
              onClick={handleShare}
              className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-colors active:scale-90"
            >
              <Share2 size={22} />
            </button>
            <button 
              onClick={() => toggleFavorite(lodge.id)}
              className={`p-3 rounded-full shadow-lg active:scale-90 transition-all ${
                isFavorite ? 'bg-red-500 text-white' : 'bg-white/20 backdrop-blur-md text-white hover:bg-white/30'
              }`}
            >
              <Heart size={22} fill={isFavorite ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        {/* Image Demarcation Badge */}
        {galleryImages.length > 0 && (
          <div className="absolute bottom-6 left-4 z-20 flex flex-col gap-2">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10 shadow-sm ${
              currentImage?.type === 'unit' ? 'bg-blue-600/90 text-white' : 'bg-gray-900/60 text-gray-200'
            }`}>
              {currentImage?.type === 'unit' ? <BedDouble size={14} /> : <Building2 size={14} />}
              <span className="text-xs font-bold uppercase tracking-wide">
                {currentImage?.label}
              </span>
            </div>
            
            {/* Counter */}
            <div className="text-[10px] text-white/80 font-mono bg-black/40 px-2 py-0.5 rounded-md w-fit">
              {imageIndex + 1} / {galleryImages.length}
            </div>
          </div>
        )}

        {/* Navigation Arrows (Desktop/Tablet) */}
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

      <div className="px-5 py-8 -mt-10 bg-white rounded-t-[40px] relative z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        
        {/* Verification Status Banner */}
        {!lodge.profiles?.is_verified ? (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex gap-3 items-start">
            <AlertTriangle className="text-orange-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="text-sm font-bold text-orange-900">Unverified Landlord</h3>
              <p className="text-xs text-orange-800 mt-1 leading-relaxed">
                Please verify this lodge physically before making any payments. Do not transfer money in advance.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
            <ShieldCheck className="text-green-600" size={16} />
            <span className="text-xs font-bold text-green-800 uppercase tracking-wide">Verified Landlord</span>
          </div>
        )}

        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0 pr-4">
            <h1 className="text-3xl font-black text-gray-900 leading-tight mb-2">
              {lodge.title}
            </h1>
            <div className="flex items-center gap-2 text-gray-500">
              <MapPin size={16} className="text-blue-500 shrink-0" />
              <span className="text-sm font-medium truncate">{lodge.location}{lodge.landmark ? `, near ${lodge.landmark}` : ''}</span>
            </div>
          </div>
        </div>

        {/* Pricing Block */}
        <div className="mb-8 py-6 border-b border-gray-100">
          <div className="flex items-end gap-2">
            <div className="text-4xl font-black text-blue-600 tracking-tight">
              {!selectedUnit && lodge.units && lodge.units.length > 1 ? (
                `From ₦${Math.min(...lodge.units.map(u => u.price)).toLocaleString()}`
              ) : (
                `₦${displayPrice.toLocaleString()}`
              )}
            </div>
            <div className="text-sm text-gray-400 font-bold uppercase mb-1.5">/ Year</div>
          </div>
        </div>

        {/* Room Types Section */}
        {lodge.units && lodge.units.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
              <BedDouble size={20} className="text-gray-400" />
              Available Rooms
            </h2>
            <div className="space-y-3">
              {lodge.units.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => {
                    setSelectedUnit(unit);
                    setPage([0, 0]); // Reset gallery to first image
                  }}
                  className={`w-full text-left p-5 rounded-[24px] border-2 transition-all duration-300 relative overflow-hidden group ${
                    selectedUnit?.id === unit.id 
                      ? 'border-blue-600 bg-blue-50/50 shadow-lg shadow-blue-100' 
                      : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-4">
                      {/* Selection Indicator */}
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selectedUnit?.id === unit.id ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                      }`}>
                         {selectedUnit?.id === unit.id && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                      </div>

                      <div>
                        <h3 className={`font-bold text-lg ${selectedUnit?.id === unit.id ? 'text-blue-900' : 'text-gray-900'}`}>
                          {unit.name}
                        </h3>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {unit.available_units > 0 ? (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-green-100 text-green-700">
                              {unit.available_units} Left
                            </span>
                          ) : (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-gray-100 text-gray-500">
                              Sold Out
                            </span>
                          )}
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-white border border-gray-100 text-gray-500">
                             ₦{unit.price.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action: View Photos */}
                  {selectedUnit?.id === unit.id && unit.image_urls && unit.image_urls.length > 0 && (
                     <div className="mt-4 pl-10">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="flex items-center gap-2 text-xs font-black text-blue-600 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-blue-100 shadow-sm hover:bg-blue-50 transition-colors"
                        >
                          <Camera size={14} /> View {unit.name} Photos
                        </button>
                     </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mb-10">
          <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
            <Info size={20} className="text-gray-400" /> 
            About this Lodge
          </h2>
          <div className="bg-gray-50 p-6 rounded-[24px] border border-gray-100">
            <p className="text-gray-600 leading-relaxed text-sm whitespace-pre-wrap font-medium">
              {lodge.description}
            </p>
          </div>
        </section>

        <section className="mb-24">
          <h2 className="text-lg font-black text-gray-900 mb-4">Amenities</h2>
          <div className="grid grid-cols-2 gap-3">
            {lodge.amenities.map((item) => (
              <div key={item} className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={16} />
                </div>
                <span className="text-sm font-bold text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-50 flex gap-3 pb-8 xs:pb-4">
        <button 
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-transform disabled:opacity-70 disabled:scale-100"
          disabled={isCalling}
          onClick={async () => {
            setIsCalling(true);
            if (user && lodge) {
              try {
                await supabase.from('notifications').insert({
                  user_id: lodge.landlord_id,
                  title: 'New Lead! 📞',
                  message: `A student just clicked to call you about "${lodge.title}".`,
                  type: 'info',
                  link: `/lodge/${lodge.id}`
                });
              } catch (err: unknown) {
                console.error('Failed to notify landlord', err);
              }
            }
            await new Promise(resolve => setTimeout(resolve, 600));
            window.location.href = `tel:${lodge.profiles?.phone_number}`;
            setTimeout(() => setIsCalling(false), 2000);
          }}
        >
          {isCalling ? <Loader2 className="animate-spin" size={20} /> : <Phone size={20} />}
          <span className="uppercase tracking-widest text-xs font-black">Call</span>
        </button>

        <button 
          className="flex-[1.5] flex items-center justify-center gap-2 py-4 bg-green-600 text-white rounded-2xl font-bold shadow-xl shadow-green-200 active:scale-95 transition-transform disabled:opacity-70 disabled:scale-100"
          disabled={isMessaging}
          onClick={async () => {
            setIsMessaging(true);
            if (user && lodge) {
              try {
                await supabase.from('notifications').insert({
                  user_id: lodge.landlord_id,
                  title: 'WhatsApp Inquiry! 💬',
                  message: `A student is messaging you about "${lodge.title}".`,
                  type: 'info',
                  link: `/lodge/${lodge.id}`
                });
              } catch (err: unknown) {
                console.error('Failed to notify landlord', err);
              }
            }
            await new Promise(resolve => setTimeout(resolve, 600));
            const message = selectedUnit 
              ? `I am interested in the ${selectedUnit.name} at ${lodge.title} (₦${selectedUnit.price.toLocaleString()})`
              : `I am interested in ${lodge.title}`;
            window.open(`https://wa.me/234${lodge.profiles?.phone_number?.substring(1)}?text=${encodeURIComponent(message)}`);
            setTimeout(() => setIsMessaging(false), 2000);
          }}
        >
          {isMessaging ? <Loader2 className="animate-spin" size={20} /> : <MessageCircle size={20} />}
          <span className="uppercase tracking-widest text-xs font-black">WhatsApp</span>
        </button>
      </div>
    </div>
  );
}