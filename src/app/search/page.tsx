'use client';

import { useState } from 'react';
import { Search as SearchIcon, MapPin, SlidersHorizontal, ChevronRight, ArrowLeft, X, Check } from 'lucide-react';
import { useData } from '@/lib/data-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    location: '',
    minPrice: '',
    maxPrice: '',
    amenities: [] as string[],
    sortBy: 'newest'
  });

  const router = useRouter();
  const { lodges } = useData();

  const filteredListings = lodges.filter(l => {
    const matchesQuery = query ? (
      l.title.toLowerCase().includes(query.toLowerCase()) || 
      l.location.toLowerCase().includes(query.toLowerCase())
    ) : true;

    const matchesLocation = filters.location ? l.location === filters.location : true;
    const matchesMinPrice = filters.minPrice ? l.price >= parseInt(filters.minPrice) : true;
    const matchesMaxPrice = filters.maxPrice ? l.price <= parseInt(filters.maxPrice) : true;
    const matchesAmenities = filters.amenities.every(a => l.amenities.includes(a));

    return matchesQuery && matchesLocation && matchesMinPrice && matchesMaxPrice && matchesAmenities;
  }).sort((a, b) => {
    if (filters.sortBy === 'price_low') return a.price - b.price;
    if (filters.sortBy === 'price_high') return b.price - a.price;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const locations = [
    { name: 'Ifite', count: lodges.filter(l => l.location === 'Ifite').length, color: 'bg-blue-500' },
    { name: 'Amansea', count: lodges.filter(l => l.location === 'Amansea').length, color: 'bg-green-500' },
    { name: 'Temp Site', count: lodges.filter(l => l.location === 'Temp Site').length, color: 'bg-orange-500' },
  ];

  const allAmenities = ['Water', 'Light', 'Security', 'Prepaid', 'Parking', 'Tiled'];

  const toggleAmenity = (a: string) => {
    setFilters(prev => ({
      ...prev,
      amenities: prev.amenities.includes(a) 
        ? prev.amenities.filter(item => item !== a) 
        : [...prev.amenities, a]
    }));
  };

  return (
    <div className="px-4 py-6 min-h-screen bg-gray-50">
      <header className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm border border-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Search</h1>
      </header>

      <div className="flex gap-2 mb-8">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try 'Self-con' or 'Ifite'..."
            className="w-full p-4 pl-12 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <SearchIcon className="absolute left-4 top-4 text-gray-400" size={20} />
        </div>
        <button 
          onClick={() => setShowFilters(true)}
          className={`p-4 rounded-2xl shadow-sm transition-all border ${
            showFilters || Object.values(filters).some(v => v && (Array.isArray(v) ? v.length > 0 : v !== '' && v !== 'newest'))
              ? 'bg-blue-600 border-blue-600 text-white' 
              : 'bg-white border-gray-100 text-gray-400'
          }`}
        >
          <SlidersHorizontal size={20} />
        </button>
      </div>

      {/* Filter Modal Overlay */}
      {showFilters && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end">
          <div className="bg-white w-full rounded-t-[32px] p-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Filters</h2>
              <button onClick={() => setShowFilters(false)} className="p-2 bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-8">
              {/* Location */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Location</label>
                <div className="flex flex-wrap gap-2">
                  {['', 'Ifite', 'Amansea', 'Temp Site'].map((loc) => (
                    <button
                      key={loc}
                      onClick={() => setFilters({...filters, location: loc})}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                        filters.location === loc 
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : 'bg-white border-gray-100 text-gray-600'
                      }`}
                    >
                      {loc || 'All'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Price Range (₦)</label>
                <div className="flex gap-4 items-center">
                  <input 
                    type="number" 
                    placeholder="Min"
                    value={filters.minPrice}
                    onChange={(e) => setFilters({...filters, minPrice: e.target.value})}
                    className="flex-1 p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-gray-300">-</div>
                  <input 
                    type="number" 
                    placeholder="Max"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters({...filters, maxPrice: e.target.value})}
                    className="flex-1 p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Amenities */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Amenities</label>
                <div className="grid grid-cols-2 gap-2">
                  {allAmenities.map((a) => (
                    <button
                      key={a}
                      onClick={() => toggleAmenity(a)}
                      className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                        filters.amenities.includes(a)
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-100 text-gray-600'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        filters.amenities.includes(a) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}>
                        {filters.amenities.includes(a) && <Check size={12} className="text-white" />}
                      </div>
                      <span className="text-xs font-medium">{a}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Sort By</label>
                <select 
                  value={filters.sortBy}
                  onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl outline-none appearance-none font-medium"
                >
                  <option value="newest">Newest First</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                </select>
              </div>

              <button 
                onClick={() => setShowFilters(false)}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100"
              >
                Apply Filters
              </button>
              
              <button 
                onClick={() => setFilters({location: '', minPrice: '', maxPrice: '', amenities: [], sortBy: 'newest'})}
                className="w-full py-2 text-gray-400 text-sm font-medium"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}

      {(query || Object.values(filters).some(v => v && (Array.isArray(v) ? v.length > 0 : v !== '' && v !== 'newest'))) ? (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4 ml-1">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Results ({filteredListings.length})</h2>
            {filteredListings.length > 0 && (
              <button 
                onClick={() => {
                  setQuery('');
                  setFilters({location: '', minPrice: '', maxPrice: '', amenities: [], sortBy: 'newest'});
                }}
                className="text-[10px] font-bold text-blue-600 uppercase"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="space-y-4">
            {filteredListings.length > 0 ? (
              filteredListings.map(lodge => (
                <Link 
                  href={`/lodge/${lodge.id}`} 
                  key={lodge.id}
                  className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-2xl shadow-sm active:bg-gray-50 transition-colors"
                >
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    <img src={lodge.image_urls[0]} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900 line-clamp-1">{lodge.title}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <MapPin size={12} className="text-blue-500" /> {lodge.location}
                    </div>
                    <div className="text-sm font-black text-blue-600 mt-1">
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
                    {/* Room Type Badges */}
                    {lodge.units && lodge.units.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Array.from(new Set(lodge.units.map(u => u.name))).map(name => (
                          <span key={name} className="px-1.5 py-0.5 bg-gray-50 text-gray-500 text-[8px] font-black uppercase tracking-tighter rounded border border-gray-100">
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-gray-300" />
                </Link>
              ))
            ) : (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200">
                <p className="text-gray-500">No lodges match your filters.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Popular Locations</h2>
          <div className="space-y-3">
            {locations.map((loc) => (
              <button 
                key={loc.name}
                onClick={() => setFilters({...filters, location: loc.name})}
                className="w-full flex items-center justify-between p-5 bg-white border border-gray-100 rounded-2xl shadow-sm active:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${loc.color} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                    <MapPin size={24} />
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900">{loc.name}</div>
                    <div className="text-xs text-gray-500">{loc.count} Lodges available</div>
                  </div>
                </div>
                <ChevronRight className="text-gray-300" size={20} />
              </button>
            ))}
          </div>

          <div className="mt-8 bg-gray-900 rounded-3xl p-6 text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-2">Need a Roommate?</h3>
              <p className="text-gray-400 text-sm mb-4">Post a request to find students sharing flats.</p>
              <Link href="/requests/new" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm">Find Now</Link>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <SearchIcon size={120} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
