'use client';

import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, MapPin, ShieldCheck, Phone, MessageCircle, Info, CheckCircle2, Heart, AlertTriangle, Camera } from 'lucide-react';
import Link from 'next/link';
import { useData } from '@/lib/data-context';
import { useAppContext } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { LodgeUnit } from '@/lib/types';

import { useLodgeViewTracker } from '@/lib/useLodgeViewTracker';

export default function LodgeDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { lodges, favorites, toggleFavorite } = useData();
  const [activeImage, setActiveImage] = useState(0);
  const [selectedUnit, setSelectedUnit] = useState<LodgeUnit | null>(null);
  
  const lodge = lodges.find(l => l.id === id);

  // Use the new custom hook for view tracking and notifications
  useLodgeViewTracker(id as string);

  useEffect(() => {
    // If lodge has units, select the first available one by default
    if (lodge?.units && lodge.units.length > 0) {
      const firstAvailable = lodge.units.find(u => u.available_units > 0);
      if (firstAvailable) setSelectedUnit(firstAvailable);
    }
  }, [lodge]);

  if (!lodge) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold">Lodge not found</h1>
        <Link href="/" className="text-blue-600 underline">Go back home</Link>
      </div>
    );
  }

  const isFavorite = favorites.includes(lodge.id);
  const displayImages = (selectedUnit && selectedUnit.image_urls && selectedUnit.image_urls.length > 0) 
    ? selectedUnit.image_urls 
    : lodge.image_urls;

  const displayPrice = selectedUnit ? selectedUnit.price : lodge.price;

  return (
    <div className="pb-32">
      {/* Header Image Area / Gallery */}
      <div className="relative h-[45vh] bg-gray-200 overflow-hidden">
        <div className="flex w-full h-full transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${activeImage * 100}%)` }}>
          {displayImages.map((img, idx) => (
            <img 
              key={idx}
              src={img} 
              alt={lodge.title}
              className="w-full h-full object-cover shrink-0"
            />
          ))}
        </div>

        {/* Back Button */}
        <button 
          onClick={() => router.back()}
          className="absolute top-6 left-4 p-3 bg-white/90 backdrop-blur rounded-full shadow-lg active:scale-90 transition-transform z-20"
        >
          <ChevronLeft size={24} />
        </button>

        {/* Favorite Button */}
        <button 
          onClick={() => toggleFavorite(lodge.id)}
          className={`absolute top-6 right-4 p-3 rounded-full shadow-lg active:scale-75 transition-all z-20 ${
            isFavorite ? 'bg-red-500 text-white' : 'bg-white/90 backdrop-blur text-gray-900'
          }`}
        >
          <Heart size={24} fill={isFavorite ? "currentColor" : "none"} />
        </button>

        {/* Gallery Dots */}
        {displayImages.length > 1 && (
          <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-1.5 z-20">
            {displayImages.map((_, idx) => (
              <button 
                key={idx}
                onClick={() => setActiveImage(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  activeImage === idx ? 'bg-white w-6' : 'bg-white/50 w-1.5'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-8 -mt-10 bg-gray-50 rounded-t-[40px] relative z-10 shadow-[-10px_0_20px_rgba(0,0,0,0.05)]">
        
        {/* Verification Status Banner */}
        {!lodge.profiles?.is_verified ? (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl flex gap-3 items-start">
            <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="text-sm font-bold text-yellow-800">Unverified Landlord</h3>
              <p className="text-xs text-yellow-700 mt-1 leading-relaxed">
                This landlord has not verified their identity. Please exercise caution, inspect the lodge physically, and <strong>never pay in advance</strong> without seeing the property.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-center gap-2">
            <ShieldCheck className="text-green-600" size={20} />
            <span className="text-sm font-bold text-green-800">Verified & Trusted Landlord</span>
          </div>
        )}

        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md uppercase tracking-wider">
                {lodge.location}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{lodge.title}</h1>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-blue-600">
              {!selectedUnit && lodge.units && lodge.units.length > 1 ? (
                <>
                  <span className="text-sm font-bold text-gray-400 block">From</span>
                  ₦{Math.min(...lodge.units.map(u => u.price)).toLocaleString()}
                </>
              ) : (
                `₦${displayPrice.toLocaleString()}`
              )}
            </div>
            <div className="text-[10px] text-gray-400 font-bold uppercase">Per Year</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-gray-500 mb-8 pb-6 border-b border-gray-100">
          <MapPin size={18} className="text-blue-500" />
          <span className="text-sm">{lodge.location}, near UNIZIK School Gate</span>
        </div>

        {/* Room Types Section */}
        {lodge.units && lodge.units.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold mb-4">Select Room Type</h2>
            <div className="space-y-3">
              {lodge.units.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => {
                    setSelectedUnit(unit);
                    setActiveImage(0);
                  }}
                  className={`w-full text-left p-5 rounded-[24px] border-2 transition-all duration-300 flex justify-between items-center group ${
                    selectedUnit?.id === unit.id 
                      ? 'border-blue-600 bg-blue-50/50 shadow-md ring-4 ring-blue-50' 
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                      selectedUnit?.id === unit.id ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-400'
                    }`}>
                      <CheckCircle2 size={24} className={selectedUnit?.id === unit.id ? 'opacity-100' : 'opacity-20'} />
                    </div>
                    <div>
                      <h3 className={`font-bold text-base ${selectedUnit?.id === unit.id ? 'text-blue-900' : 'text-gray-900'}`}>
                        {unit.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {unit.available_units > 0 ? (
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                            selectedUnit?.id === unit.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {unit.available_units} Available
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-50 text-red-500">
                            Sold Out
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Price</p>
                    <div className={`font-black text-lg ${selectedUnit?.id === unit.id ? 'text-blue-600' : 'text-gray-900'}`}>
                      ₦{unit.price.toLocaleString()}
                    </div>
                    {selectedUnit?.id === unit.id && unit.image_urls && unit.image_urls.length > 0 && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="mt-2 flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase bg-white px-2 py-1 rounded-lg border border-blue-100 shadow-sm"
                      >
                        <Camera size={12} /> View Photos
                      </button>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Info size={20} className="text-gray-400" /> Description
          </h2>
          <p className="text-gray-600 leading-relaxed text-sm">
            {lodge.description}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold mb-4">Amenities</h2>
          <div className="grid grid-cols-2 gap-3">
            {lodge.amenities.map((item) => (
              <div key={item} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-2xl shadow-sm">
                <CheckCircle2 size={18} className="text-green-500" />
                <span className="text-sm font-medium text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-lg border-t border-gray-100 z-50 flex gap-4">
        <button 
          className="flex-1 flex items-center justify-center gap-3 py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-transform"
          onClick={() => window.open(`tel:${lodge.profiles?.phone_number}`)}
        >
          <Phone size={20} /> Call Now
        </button>
        <button 
          className="flex-1 flex items-center justify-center gap-3 py-4 bg-green-600 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-transform"
          onClick={() => {
            const message = selectedUnit 
              ? `I am interested in the ${selectedUnit.name} at ${lodge.title} (₦${selectedUnit.price.toLocaleString()})`
              : `I am interested in ${lodge.title}`;
            window.open(`https://wa.me/234${lodge.profiles?.phone_number?.substring(1)}?text=${encodeURIComponent(message)}`);
          }}
        >
          <MessageCircle size={20} /> WhatsApp
        </button>
      </div>
    </div>
  );
}