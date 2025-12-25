'use client';

import { useAppContext } from '@/lib/context';
import { useData } from '@/lib/data-context';
import { LodgeSkeleton } from '@/components/Skeleton';
import { MapPin, Phone, MessageCircle, Heart, ChevronLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function FavoritesPage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useAppContext();
  const { lodges, favorites, toggleFavorite, isLoading: isDataLoading } = useData();

  if (isUserLoading || isDataLoading) {
    return (
      <div className="px-4 py-6">
        <div className="space-y-4 mb-8">
          <div className="h-8 w-40 bg-gray-200 rounded-lg animate-shimmer" />
        </div>
        <div className="space-y-6">
          <LodgeSkeleton />
          <LodgeSkeleton />
        </div>
      </div>
    );
  }

  // Filter lodges that are in the favorites list
  const favoriteLodges = lodges.filter(lodge => favorites.includes(lodge.id));

  return (
    <div className="px-4 py-6 pb-24">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm border border-gray-100 active:scale-90 transition-transform">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Saved Lodges</h1>
      </header>

      {favoriteLodges.length > 0 ? (
        <div className="space-y-6">
          {favoriteLodges.map((lodge) => {
             const isVerified = lodge.profiles?.is_verified === true;
             const hasPhone = !!lodge.profiles?.phone_number;

             return (
              <div key={lodge.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 relative group">
                <Link href={`/lodge/${lodge.id}`}>
                  <div className="relative h-56 w-full bg-gray-100">
                    <img 
                      src={lodge.image_urls[0]} 
                      alt={lodge.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-active:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute bottom-4 left-4 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <div className="px-3 py-1 bg-blue-600/90 backdrop-blur text-white text-[10px] font-bold rounded-lg uppercase tracking-wider">
                          {lodge.location}
                        </div>
                        {isVerified && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-green-500/90 backdrop-blur text-white text-[10px] font-bold rounded-lg uppercase tracking-wider shadow-sm">
                            <CheckCircle size={12} /> Verified
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
                
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(lodge.id);
                  }}
                  className="absolute top-4 right-4 p-2 rounded-full shadow-lg bg-red-500 text-white active:scale-75 transition-all"
                >
                  <Heart size={20} fill="currentColor" />
                </button>
                
                <div className="p-5">
                  <Link href={`/lodge/${lodge.id}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg text-gray-900 leading-tight">{lodge.title}</h3>
                      <div className="text-right">
                        <div className="text-blue-600 font-black text-sm">
                          {lodge.units && lodge.units.length > 0 ? (
                            (() => {
                              const prices = lodge.units.map(u => u.price);
                              const min = Math.min(...prices);
                              const max = Math.max(...prices);
                              return min === max 
                                ? `₦${min.toLocaleString()}`
                                : `From ₦${min.toLocaleString()} - ₦${max.toLocaleString()}`;
                            })()
                          ) : (
                            `₦${lodge.price.toLocaleString()}`
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                  
                  {hasPhone ? (
                    <div className="flex gap-2 mt-4">
                      <button 
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl font-medium active:scale-95 transition-transform"
                        onClick={() => window.open(`tel:${lodge.profiles?.phone_number}`)}
                      >
                        <Phone size={18} /> Call
                      </button>
                      <button 
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-medium active:scale-95 transition-transform"
                        onClick={() => window.open(`https://wa.me/234${lodge.profiles?.phone_number?.substring(1)}?text=Hello, I am interested in ${lodge.title}`)}
                      >
                        <MessageCircle size={18} /> WhatsApp
                      </button>
                    </div>
                  ) : (
                    <div className="py-2 px-4 bg-gray-50 rounded-xl text-center text-xs text-gray-400 font-medium italic mt-4">
                      Contact details not provided
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-gray-300">
            <Heart size={40} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Saved Lodges</h2>
          <p className="text-gray-500 max-w-[250px]">
            Lodges you save will appear here. Start exploring to find your next home!
          </p>
          <Link href="/" className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all">
            Explore Lodges
          </Link>
        </div>
      )}
    </div>
  );
}
