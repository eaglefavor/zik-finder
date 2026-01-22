'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search as SearchIcon, MapPin, SlidersHorizontal, ArrowLeft, X, Check, Banknote, Loader2 } from 'lucide-react';
import { useData } from '@/lib/data-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROOM_TYPE_PRESETS, AREA_LANDMARKS, AMENITIES } from '@/lib/constants';
import Image from 'next/image';
import { LodgeUnit } from '@/lib/types';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Flatten landmarks for search suggestions or advanced filtering if needed
  const allLocations = useMemo(() => Object.keys(AREA_LANDMARKS), []);

  const [filters, setFilters] = useState({
    location: '',
    roomType: '',
    minPrice: '',
    maxPrice: '',
    amenities: [] as string[],
    sortBy: 'newest'
  });

  const router = useRouter();
  const { lodges } = useData();
  
  const [searchResults, setSearchResults] = useState<typeof lodges>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced Server Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length > 1) {
        setIsSearching(true);
        try {
          const res = await fetch(`/api/lodges/search?q=${encodeURIComponent(query)}`);
          const { data } = await res.json();
          if (data) setSearchResults(data);
        } catch (err) {
          console.error("Search failed", err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const filteredListings = useMemo(() => {
    // Source: If query exists, use server results. Otherwise, use local feed.
    const sourceData = query.trim().length > 1 ? searchResults : lodges;

    return sourceData.filter(l => {
      // 0. Status Filter (Only show available lodges to students)
      // Note: API already filters by status, but local feed might not
      if (l.status && l.status !== 'available') return false;

      // 1. Text Search (Client-side refinement or fallback)
      // If we used API, we trust it matches the text. If local, we verify.
      const matchesQuery = query ? (
        sourceData === searchResults ? true : (
          l.title.toLowerCase().includes(query.toLowerCase()) || 
          l.location.toLowerCase().includes(query.toLowerCase())
        )
      ) : true;

      // 2. Strict Location Filter
      const matchesLocation = filters.location ? l.location === filters.location : true;
      
      // 3. Room Type Filter (Checks against all units in a lodge)
      const matchesRoomType = filters.roomType 
        ? l.units?.some((u: LodgeUnit) => u.name === filters.roomType || (filters.roomType === 'Other' && !ROOM_TYPE_PRESETS.includes(u.name)))
        : true;

      // 4. Price Filter (Checks if ANY unit falls within range, or the base price)
      // If lodge has units, we check if at least one unit matches the price range.
      // If no units, we check the lodge.price.
      let matchesPrice = true;
      const min = filters.minPrice ? parseInt(filters.minPrice) : 0;
      const max = filters.maxPrice ? parseInt(filters.maxPrice) : Infinity;

      if (l.units && l.units.length > 0) {
        matchesPrice = l.units.some((u: LodgeUnit) => u.price >= min && u.price <= max);
      } else {
        matchesPrice = l.price >= min && l.price <= max;
      }

      // 5. Amenities Filter (AND logic - must have ALL selected)
      // Note: API results might not include amenities column for performance, 
      // so we might need to be careful. The current API select includes limited fields.
      // Let's assume for now API returns partial data. If amenities is missing, we can't filter by it.
      const matchesAmenities = l.amenities ? filters.amenities.every(a => l.amenities.includes(a)) : (filters.amenities.length === 0);

      return matchesQuery && matchesLocation && matchesRoomType && matchesPrice && matchesAmenities;
    }).sort((a, b) => {
      // Sort logic
      // For price sorting, we need a "representative" price. 
      // Usually the minimum price is good for sorting "Low to High".
      const getPrice = (lodge: typeof lodges[0]) => {
        if (lodge.units && lodge.units.length > 0) {
          return Math.min(...lodge.units.map((u: LodgeUnit) => u.price));
        }
        return lodge.price;
      };

      const priceA = getPrice(a);
      const priceB = getPrice(b);

      if (filters.sortBy === 'price_low') return priceA - priceB;
      if (filters.sortBy === 'price_high') return priceB - priceA;
      
      // Fallback sort for API results that might lack created_at
      if (!a.created_at) return 0;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [lodges, searchResults, query, filters]);

  const activeFilterCount = [
    filters.location,
    filters.roomType,
    filters.minPrice,
    filters.maxPrice,
    ...filters.amenities
  ].filter(Boolean).length;

  const toggleAmenity = (a: string) => {
    setFilters(prev => ({
      ...prev,
      amenities: prev.amenities.includes(a) 
        ? prev.amenities.filter(item => item !== a) 
        : [...prev.amenities, a]
    }));
  };

  const clearFilters = () => {
    setFilters({
      location: '',
      roomType: '',
      minPrice: '',
      maxPrice: '',
      amenities: [],
      sortBy: 'newest'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-gray-50/95 backdrop-blur-md px-4 py-4 border-b border-gray-100">
        <header className="flex items-center gap-4 mb-4">
          <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm border border-gray-100 active:scale-90 transition-transform">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Find your Lodge</h1>
        </header>

        <div className="flex gap-2">
          <div className="relative flex-1 group">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, area, or description..."
              className="w-full p-3.5 pl-11 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 font-medium text-sm"
            />
            {isSearching ? (
              <Loader2 className="absolute left-4 top-3.5 text-blue-500 animate-spin" size={20} />
            ) : (
              <SearchIcon className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            )}
            {query && (
              <button 
                onClick={() => setQuery('')}
                className="absolute right-3 top-3.5 p-0.5 bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button 
            onClick={() => setShowFilters(true)}
            className={`p-3.5 rounded-2xl shadow-sm transition-all border flex items-center justify-center relative ${
              showFilters || activeFilterCount > 0
                ? 'bg-blue-600 border-blue-600 text-white' 
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal size={20} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
        
        {/* Quick Filter Chips (Visible if no specific location/room selected yet to encourage quick tapping) */}
        {!filters.location && !filters.roomType && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
            {allLocations.map(loc => (
               <button 
                 key={loc}
                 onClick={() => setFilters(prev => ({ ...prev, location: loc }))}
                 className="whitespace-nowrap px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors shadow-sm"
               >
                 {loc}
               </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {filters.location && (
               <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100 flex items-center gap-1">
                 <MapPin size={12} /> {filters.location}
                 <button onClick={() => setFilters(p => ({...p, location: ''}))}><X size={12} /></button>
               </span>
            )}
            {filters.roomType && (
               <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs font-bold rounded-lg border border-purple-100 flex items-center gap-1">
                 {filters.roomType}
                 <button onClick={() => setFilters(p => ({...p, roomType: ''}))}><X size={12} /></button>
               </span>
            )}
            {(filters.minPrice || filters.maxPrice) && (
               <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-100 flex items-center gap-1">
                 ₦{filters.minPrice || '0'} - {filters.maxPrice ? `₦${filters.maxPrice}` : '∞'}
                 <button onClick={() => setFilters(p => ({...p, minPrice: '', maxPrice: ''}))}><X size={12} /></button>
               </span>
            )}
            {filters.amenities.map(a => (
              <span key={a} className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg border border-gray-200 flex items-center gap-1">
                {a}
                <button onClick={() => toggleAmenity(a)}><X size={12} /></button>
              </span>
            ))}
            <button onClick={clearFilters} className="text-xs font-bold text-red-500 underline ml-2">Clear All</button>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              {filteredListings.length} Result{filteredListings.length !== 1 && 's'} Found
            </h2>
            {/* Sort Dropdown (Simplified) */}
             <div className="relative">
                <select 
                  value={filters.sortBy} 
                  onChange={(e) => setFilters(p => ({...p, sortBy: e.target.value}))}
                  className="appearance-none bg-transparent text-xs font-bold text-gray-500 text-right pr-4 outline-none cursor-pointer"
                >
                  <option value="newest">Newest</option>
                  <option value="price_low">Price: Low - High</option>
                  <option value="price_high">Price: High - Low</option>
                </select>
             </div>
          </div>

          {filteredListings.length > 0 ? (
            filteredListings.map(lodge => (
              <Link 
                href={`/lodge/${lodge.id}`} 
                key={lodge.id}
                className="flex items-start gap-4 p-3 bg-white border border-gray-100 rounded-2xl shadow-sm active:scale-[0.99] transition-all"
              >
                <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  <Image src={lodge.image_urls[0]} fill className="object-cover" alt={lodge.title} />
                  {/* Status Badges */}
                  {lodge.units?.reduce((acc, u) => acc + u.available_units, 0) === 0 && (
                     <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                       <span className="text-white text-[10px] font-black uppercase tracking-wider border border-white px-2 py-1 rounded-md">Sold Out</span>
                     </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 py-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-gray-900 line-clamp-1 text-base">{lodge.title}</h3>
                    {/* Price Display */}
                    <div className="text-blue-600 font-black text-xs whitespace-nowrap ml-2">
                       {lodge.units && lodge.units.length > 0 ? (
                        (() => {
                          const prices = lodge.units.map(u => u.price);
                          const min = Math.min(...prices);
                          const max = Math.max(...prices);
                          return min === max 
                            ? `₦${min.toLocaleString()}`
                            : `₦${min.toLocaleString()}+`;
                        })()
                      ) : (
                        `₦${lodge.price.toLocaleString()}`
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-1 font-medium">
                    <MapPin size={12} className="text-gray-400" /> {lodge.location}
                  </div>

                  {/* Room Types available */}
                  {lodge.units && lodge.units.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Array.from(new Set(lodge.units.map(u => u.name))).slice(0, 3).map(name => (
                        <span key={name} className="px-1.5 py-0.5 bg-gray-50 text-gray-600 text-[9px] font-bold uppercase tracking-tight rounded border border-gray-100 truncate max-w-[100px]">
                          {name}
                        </span>
                      ))}
                      {new Set(lodge.units.map(u => u.name)).size > 3 && (
                        <span className="px-1.5 py-0.5 text-gray-400 text-[9px] font-bold">+More</span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-300">
                <SearchIcon size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">No matches found</h3>
              <p className="text-gray-500 text-sm max-w-[200px] mt-2">Try adjusting your filters or try searching for:</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {['Ifite', 'Amansea', 'Self-con', 'Flat'].map(tag => (
                  <button 
                    key={tag} 
                    onClick={() => {
                      if (tag === 'Self-con' || tag === 'Flat') setFilters({...filters, roomType: tag});
                      else setQuery(tag);
                    }}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-blue-600 shadow-sm active:scale-95 transition-all"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <button onClick={clearFilters} className="mt-8 text-gray-400 font-bold text-xs underline">Clear all filters</button>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filter Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-[32px] rounded-t-[32px] max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Filters</h2>
              <button onClick={() => setShowFilters(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Location */}
              <section>
                <label className="block text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin size={16} className="text-blue-600" /> Location
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFilters({...filters, location: ''})}
                    className={`p-3 rounded-xl text-xs font-bold border transition-all ${
                      filters.location === '' 
                        ? 'bg-blue-600 border-blue-600 text-white' 
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Anywhere
                  </button>
                  {allLocations.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => setFilters({...filters, location: loc})}
                      className={`p-3 rounded-xl text-xs font-bold border transition-all ${
                        filters.location === loc 
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </section>

              {/* Room Type */}
              <section>
                <label className="block text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Banknote size={16} className="text-blue-600" /> Room Type
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                     onClick={() => setFilters({...filters, roomType: ''})}
                     className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                       filters.roomType === '' 
                         ? 'bg-blue-600 border-blue-600 text-white' 
                         : 'bg-white border-gray-200 text-gray-600'
                     }`}
                   >
                     Any
                   </button>
                  {ROOM_TYPE_PRESETS.map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilters({...filters, roomType: type})}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                        filters.roomType === type 
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                  <button
                     onClick={() => setFilters({...filters, roomType: 'Other'})}
                     className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                       filters.roomType === 'Other'
                         ? 'bg-blue-600 border-blue-600 text-white' 
                         : 'bg-white border-gray-200 text-gray-600'
                     }`}
                   >
                     Other
                   </button>
                </div>
              </section>

              {/* Price Range */}
              <section>
                <label className="block text-sm font-bold text-gray-900 mb-3">Price Range (₦)</label>
                <div className="flex gap-4 items-center">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-3 text-gray-400 text-xs font-bold">MIN</span>
                    <input 
                      type="number" 
                      value={filters.minPrice}
                      onChange={(e) => setFilters({...filters, minPrice: e.target.value})}
                      className="w-full p-3 pt-7 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                    />
                  </div>
                  <div className="text-gray-300">-</div>
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-3 text-gray-400 text-xs font-bold">MAX</span>
                    <input 
                      type="number" 
                      value={filters.maxPrice}
                      onChange={(e) => setFilters({...filters, maxPrice: e.target.value})}
                      className="w-full p-3 pt-7 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                    />
                  </div>
                </div>
              </section>

              {/* Amenities */}
              <section>
                <label className="block text-sm font-bold text-gray-900 mb-3">Amenities</label>
                <div className="grid grid-cols-2 gap-2">
                  {AMENITIES.map((a) => (
                    <button
                      key={a}
                      onClick={() => toggleAmenity(a)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        filters.amenities.includes(a)
                          ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        filters.amenities.includes(a) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                      }`}>
                        {filters.amenities.includes(a) && <Check size={14} className="text-white" />}
                      </div>
                      <span className="text-xs font-bold">{a}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-50 bg-white pb-8 sm:pb-6 rounded-b-[32px]">
              <div className="flex gap-3">
                <button 
                  onClick={clearFilters}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold active:scale-95 transition-transform"
                >
                  Reset
                </button>
                <button 
                  onClick={() => setShowFilters(false)}
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform"
                >
                  Show Results
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
