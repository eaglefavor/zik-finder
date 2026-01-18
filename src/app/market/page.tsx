'use client';

import { useAppContext } from '@/lib/context';
import { useData } from '@/lib/data-context';
import { supabase } from '@/lib/supabase';
import { RequestSkeleton } from '@/components/Skeleton';
import { User, MapPin, Clock, MessageCircle, Trash2, PlusCircle, X, Loader2, ChevronRight, Search, Sparkles, Unlock, SlidersHorizontal, Banknote } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

const AREA_LANDMARKS: Record<string, string[]> = {
  'Ifite': ['School Gate', 'Book Foundation', 'Wimpey', 'Miracle Junction', 'First Market', 'Second Market', 'Perm Site'],
  'Amansea': ['Green Villa', 'Yaho Junction', 'Behind Unizik', 'Cameron'],
  'Okpuno': ['Roban Stores', 'Udoka', 'Regina Caeli'],
  'Temp Site': ['Juhel', 'St. Joseph', 'Okofia'],
  'Agu Awka': ['Immigration', 'Anambra State Secretariat', 'Aroma']
};

const ROOM_TYPE_KEYWORDS = ['self con', 'self-con', 'self contained', 'flat', 'apartment', 'single room', 'shared', '2 bedroom', '3 bedroom'];
const AMENITY_KEYWORDS = ['water', 'light', 'power', 'security', 'fenced', 'tile', 'wardrobe', 'ac', 'a/c', 'generator', 'wifi'];

export default function MarketRequests() {
  const { role, user, isLoading } = useAppContext();
  const { requests, deleteRequest, lodges, notifyStudentOfMatch } = useData();
  const [showLodgeSelector, setShowLodgeSelector] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isNotifying, setIsNotifying] = useState(false);
  
  // Robust Filtering State
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    location: '',
    minBudget: '',
    maxBudget: '',
    sortBy: 'newest' // newest, match_score, budget_low, budget_high
  });
  
  // ZIPS: Unlocked Requests State
  const [unlockedRequests, setUnlockedRequests] = useState<Record<string, string>>({}); // requestId -> phone_number
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  // Helper to calculate cost
  const getUnlockCost = (budget: number) => {
    if (budget >= 700000) return 20;
    if (budget >= 300000) return 15;
    return 10;
  };

  // Derive unique locations from existing requests + Presets
  const allLocations = useMemo(() => {
    const requestLocs = new Set(requests.map(r => r.location));
    Object.keys(AREA_LANDMARKS).forEach(l => requestLocs.add(l));
    return Array.from(requestLocs).sort();
  }, [requests]);

  const activeFilterCount = [
    filters.location,
    filters.minBudget,
    filters.maxBudget
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilters({
      location: '',
      minBudget: '',
      maxBudget: '',
      sortBy: 'newest'
    });
    setQuery('');
  };

  // Fetch unlocked requests on mount
  useEffect(() => {
    if (user && (role === 'landlord' || role === 'admin')) {
      const fetchUnlocked = async () => {
        const { data } = await supabase
          .from('leads')
          .select('request_id, profiles!leads_student_id_fkey(phone_number)')
          .eq('landlord_id', user.id)
          .eq('type', 'request_unlock')
          .eq('status', 'unlocked');
        
        if (data) {
          const map: Record<string, string> = {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.forEach((lead: any) => {
            if (lead.request_id) map[lead.request_id] = lead.profiles?.phone_number;
          });
          setUnlockedRequests(map);
        }
      };
      fetchUnlocked();
    }
  }, [user, role]);

  const handleUnlock = async (request: typeof requests[0]) => {
    if (!user) return;
    
    setUnlockingId(request.id);
    try {
      const { data, error } = await supabase.rpc('unlock_student_request', { p_request_id: request.id });
      
      if (error) throw error;
      if (data.success) {
        toast.success(`Unlocked! Balance: ${data.remaining_balance} Credits`);
        setUnlockedRequests(prev => ({ ...prev, [request.id]: data.phone_number }));
      } else {
        toast.error(data.message);
      }
    } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error('Unlock failed: ' + (err as any).message);
    } finally {
      setUnlockingId(null);
    }
  };

  // Landlord's active lodges
  const landlordLodges = useMemo(() => 
    lodges.filter(l => l.landlord_id === user?.id && l.status === 'available'),
    [lodges, user?.id]
  );

  // Match Score Calculation (Deep Heuristics)
  const calculateMatchScore = useCallback((request: typeof requests[0]) => {
    if (landlordLodges.length === 0) return 0;
    
    let bestScore = 0;
    const reqDesc = request.description.toLowerCase();
    const reqLocs = (request.locations || [request.location]).map(l => l.toLowerCase());
    
    // Extract Budget
    const reqMaxBudget = request.max_budget || request.min_budget || 0;
    
    // Extract Room Type Keywords from Request
    const reqRoomTypes = ROOM_TYPE_KEYWORDS.filter(k => reqDesc.includes(k) || request.budget_range.toLowerCase().includes(k));
    
    // Extract Amenity Keywords from Request
    const reqAmenities = AMENITY_KEYWORDS.filter(k => reqDesc.includes(k));

    for (const lodge of landlordLodges) {
      let score = 0;
      
      // 1. Location Scoring (Max 30)
      const lodgeLoc = lodge.location.toLowerCase();
      // Exact or Contained Match (e.g. "Ifite" in "Ifite") -> 30
      // Proximity/Sub-area Match (e.g. "School Gate" in "Ifite") -> 15
      const isExactLoc = reqLocs.some(rl => lodgeLoc.includes(rl) || rl.includes(lodgeLoc) || rl === 'any location');
      
      if (isExactLoc) {
        score += 30;
      } else {
        // Check adjacency/sub-areas defined in AREA_LANDMARKS
        let isAdjacent = false;
        for (const [mainArea, subAreas] of Object.entries(AREA_LANDMARKS)) {
          const mainLower = mainArea.toLowerCase();
          // If lodge is in main area, and request is for a sub-area (or vice versa)
          if ((lodgeLoc.includes(mainLower) && reqLocs.some(rl => subAreas.some(sa => sa.toLowerCase().includes(rl)))) ||
              (reqLocs.some(rl => rl.includes(mainLower)) && subAreas.some(sa => sa.toLowerCase().includes(lodgeLoc)))) {
            isAdjacent = true;
            break;
          }
        }
        if (isAdjacent) score += 15;
      }

      // 2. Budget Scoring (Max 35) - Exponential Decay
      if (reqMaxBudget > 0) {
        if (lodge.price <= reqMaxBudget) {
          score += 35; // Within budget
        } else {
          // Calculate overflow percentage
          const diff = lodge.price - reqMaxBudget;
          const overflowRatio = diff / reqMaxBudget; // e.g. 0.1 for 10% over
          
          // Allow up to 50% over budget, decaying score
          // Formula: 35 * (1 - (overflowRatio * 2)) -> reaches 0 at 50% overflow
          const budgetScore = Math.max(0, 35 * (1 - (overflowRatio * 2)));
          score += budgetScore;
        }
      } else {
        // No budget specified, give heuristic base points if not too expensive (>1M might be mismatched for vague request)
        score += lodge.price < 500000 ? 25 : 15;
      }

      // 3. Room Type Scoring (Max 20)
      if (reqRoomTypes.length > 0 && lodge.units) {
        const lodgeUnitNames = lodge.units.map(u => u.name.toLowerCase());
        const hasTypeMatch = reqRoomTypes.some(rt => lodgeUnitNames.some(lun => lun.includes(rt) || rt.includes(lun)));
        if (hasTypeMatch) score += 20;
      } else if (reqRoomTypes.length === 0) {
        // If student didn't specify type, give neutral points
        score += 10;
      }

      // 4. Amenities Scoring (Max 10)
      if (reqAmenities.length > 0) {
        const lodgeAmenities = (lodge.amenities || []).map(a => a.toLowerCase());
        // Also check description for amenities
        const lodgeDesc = lodge.description.toLowerCase();
        
        let matchCount = 0;
        reqAmenities.forEach(ra => {
          if (lodgeAmenities.some(la => la.includes(ra)) || lodgeDesc.includes(ra)) {
            matchCount++;
          }
        });
        
        // 2 points per match, up to 10
        score += Math.min(10, matchCount * 2);
      } else {
        score += 5; // Neutral
      }

      // 5. Quality/Trust Bonus (Max 5)
      if (lodge.profiles?.is_verified) score += 3;
      if ((lodge.landlord_z_score || 0) > 60) score += 2;

      if (score > bestScore) bestScore = score;
    }
    
    // Cap at 99% (Reserve 100% for some future perfect state)
    return Math.min(99, Math.round(bestScore));
  }, [landlordLodges]);

  const filteredRequests = useMemo(() => {
    return requests
      .filter(r => {
        // 1. Search Query
        const searchLower = query.toLowerCase();
        const matchesQuery = 
          r.student_name.toLowerCase().includes(searchLower) ||
          r.description.toLowerCase().includes(searchLower) ||
          r.location.toLowerCase().includes(searchLower) ||
          r.locations?.some(loc => loc.toLowerCase().includes(searchLower));

        if (!matchesQuery) return false;

        // 2. Location Filter
        if (filters.location && !r.location.includes(filters.location) && !r.locations?.some(l => l.includes(filters.location))) {
          return false;
        }

        // 3. Budget Filter
        const min = filters.minBudget ? parseInt(filters.minBudget) : 0;
        const max = filters.maxBudget ? parseInt(filters.maxBudget) : Infinity;
        
        // Use max_budget as the primary indicator, fallback to min_budget
        const reqBudget = r.max_budget || r.min_budget || 0;
        
        if (reqBudget < min || (r.min_budget || 0) > max) {
           return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Priority 1: Match Score (if landlord)
        if (filters.sortBy === 'match_score') {
          return calculateMatchScore(b) - calculateMatchScore(a);
        }

        if (filters.sortBy === 'newest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        
        // Helper to get a numeric budget for sorting
        const getBudget = (req: typeof a) => {
          if (req.min_budget) return req.min_budget;
          // Try to parse from legacy budget_range (e.g. "₦150,000")
          const match = req.budget_range.match(/\d+/g);
          return match ? parseInt(match.join('')) : 0;
        };

        const budgetA = getBudget(a);
        const budgetB = getBudget(b);

        if (filters.sortBy === 'budget_low') return budgetA - budgetB;
        if (filters.sortBy === 'budget_high') return budgetB - budgetA;
        
        return 0;
      });
  }, [requests, query, filters, calculateMatchScore]);

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const handleDeleteRequest = (id: string) => {
    toast.error('Delete this request?', {
      description: 'This will remove your request from the marketplace.',
      action: {
        label: 'Delete',
        onClick: async () => {
          await deleteRequest(id);
          toast.success('Request deleted');
        }
      }
    });
  };

  const handleMatchNotify = async (lodgeId: string) => {
    if (!selectedStudentId) return;
    setIsNotifying(true);
    const { success, error } = await notifyStudentOfMatch(selectedStudentId, lodgeId);
    setIsNotifying(false);
    
    if (success) {
      toast.success('Student notified!', {
        description: 'They will see your lodge in their notifications.'
      });
      setShowLodgeSelector(false);
      setSelectedStudentId(null);
    } else {
      toast.error('Failed to notify student: ' + error);
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 py-6 pb-24">
        <div className="space-y-4 mb-8">
          <div className="h-10 w-48 bg-gray-200 rounded-2xl animate-pulse" />
          <div className="h-4 w-64 bg-gray-100 rounded-lg animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => <RequestSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24">
      {/* Premium Header - Optimized for small screens */}
      <div className="bg-white border-b border-gray-100 px-4 py-6 sticky top-0 z-30 shadow-sm shadow-gray-100/50 backdrop-blur-xl bg-white/80">
        <div className="flex justify-between items-start mb-5">
          <div className="min-w-0 pr-2">
            <h1 className="text-2xl xs:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              {role === 'student' ? 'Requests' : 'Marketplace'} <Sparkles className="text-blue-500 fill-blue-500 shrink-0" size={18} />
            </h1>
            <p className="text-xs xs:text-sm text-gray-500 font-medium mt-0.5 truncate">
              {role === 'student' ? 'See what others are asking for' : 'Connect with students looking for lodges'}
            </p>
          </div>
          {role === 'student' && (
            <Link 
              href="/requests/new" 
              className="p-2.5 xs:p-3 bg-blue-600 text-white rounded-xl xs:rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all hover:bg-blue-700 group shrink-0"
            >
              <PlusCircle size={22} className="group-hover:rotate-90 transition-transform duration-300" />
            </Link>
          )}
        </div>

        {/* Robust Search & Filter Bar */}
        <div className="flex gap-2 group">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
            <input 
              type="text"
              placeholder="Search area, description..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 p-3.5 pl-11 rounded-xl xs:rounded-2xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-medium text-sm"
            />
            {query && (
              <button 
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300 transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
          
          <button 
            onClick={() => setShowFilters(true)}
            className={`p-3.5 rounded-xl xs:rounded-2xl shadow-sm transition-all border flex items-center justify-center relative ${
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
        
        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {filters.location && (
               <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-100 flex items-center gap-1">
                 <MapPin size={10} /> {filters.location}
                 <button onClick={() => setFilters(p => ({...p, location: ''}))}><X size={10} /></button>
               </span>
            )}
            {(filters.minBudget || filters.maxBudget) && (
               <span className="px-2.5 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-lg border border-green-100 flex items-center gap-1">
                 <Banknote size={10} /> ₦{Number(filters.minBudget || 0).toLocaleString()} - {filters.maxBudget ? `₦${Number(filters.maxBudget).toLocaleString()}` : '∞'}
                 <button onClick={() => setFilters(p => ({...p, minBudget: '', maxBudget: ''}))}><X size={10} /></button>
               </span>
            )}
            <button onClick={clearFilters} className="text-[10px] font-bold text-red-500 underline ml-1">Clear All</button>
          </div>
        )}
      </div>

      <div className="px-3 xs:px-4 py-6 space-y-6">
        {/* Requests List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {filteredRequests.length} Request{filteredRequests.length !== 1 && 's'} Found
            </h2>
            {/* Sort Dropdown - Integrated */}
             <div className="relative">
                <select 
                  value={filters.sortBy} 
                  onChange={(e) => setFilters(p => ({...p, sortBy: e.target.value}))}
                  className="appearance-none bg-transparent text-xs font-bold text-gray-500 text-right pr-4 outline-none cursor-pointer focus:text-blue-600"
                >
                  <option value="newest">Newest First</option>
                  {(role === 'landlord' || role === 'admin') && <option value="match_score">Compatibility</option>}
                  <option value="budget_low">Budget: Low - High</option>
                  <option value="budget_high">Budget: High - Low</option>
                </select>
                <ChevronRight className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 rotate-90 pointer-events-none" size={12} />
             </div>
          </div>

          <AnimatePresence mode='popLayout'>
            {filteredRequests.map((request, index) => {
              const isOwnRequest = user?.id === request.student_id;
              
              return (
                <motion.div 
                  key={request.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-white p-4 xs:p-6 rounded-[24px] xs:rounded-[32px] shadow-sm border transition-all ${
                    isOwnRequest 
                      ? 'border-blue-200 ring-4 ring-blue-500/5' 
                      : 'border-gray-100 hover:border-blue-100 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between mb-5 gap-3">
                    <div className="flex items-center gap-3 xs:gap-4 min-w-0">
                      <div className="w-10 h-10 xs:w-12 xs:h-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl xs:rounded-2xl flex items-center justify-center text-gray-400 border border-gray-100 shrink-0">
                        <User size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 flex flex-wrap items-center gap-1.5 text-base xs:text-lg leading-tight">
                          <span className="truncate">{request.student_name}</span>
                          {isOwnRequest && (
                            <span className="text-[8px] xs:text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase font-black tracking-widest whitespace-nowrap">You</span>
                          )}
                        </div>
                        <div className="text-[9px] xs:text-[10px] text-gray-400 flex items-center gap-1 font-black uppercase tracking-widest mt-0.5">
                          <Clock size={10} className="text-blue-500" /> {formatTime(request.created_at)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Smart Match Score Badge for Landlords */}
                    {(role === 'landlord' || role === 'admin') && !isOwnRequest && landlordLodges.length > 0 && (
                      <div className="shrink-0 flex flex-col items-end">
                        <div className={`px-2 py-1 rounded-lg flex items-center gap-1.5 border ${
                          calculateMatchScore(request) >= 80 ? 'bg-green-50 border-green-100 text-green-700' :
                          calculateMatchScore(request) >= 40 ? 'bg-blue-50 border-blue-100 text-blue-700' :
                          'bg-gray-50 border-gray-100 text-gray-500'
                        }`}>
                          <Sparkles size={10} className={calculateMatchScore(request) >= 80 ? 'animate-pulse' : ''} />
                          <span className="text-[9px] font-black uppercase tracking-tighter">
                            {calculateMatchScore(request)}% Match
                          </span>
                        </div>
                        <span className="text-[8px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Compatibility</span>
                      </div>
                    )}

                    {isOwnRequest && (
                      <div className="flex gap-1.5 shrink-0">
                        <button 
                          onClick={() => {
                            toast.success('Found a lodge!', {
                              description: 'Marking this as fulfilled will hide it from the marketplace.',
                              action: {
                                label: 'Confirm',
                                onClick: () => handleDeleteRequest(request.id)
                              }
                            });
                          }}
                          className="px-2.5 py-1.5 bg-green-50 text-green-600 rounded-lg xs:rounded-xl text-[9px] xs:text-[10px] font-black uppercase border border-green-100 active:scale-95"
                        >
                          Found it
                        </button>
                        <button 
                          onClick={() => handleDeleteRequest(request.id)}
                          className="p-1.5 xs:p-2 bg-gray-50 text-gray-400 hover:text-red-500 rounded-lg xs:rounded-xl transition-all active:scale-95"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Requirements Section - More compact for small screens */}
                  <div className="space-y-2 mb-5">
                    <div className="flex items-start gap-2.5 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/30">
                      <MapPin size={14} className="text-blue-600 shrink-0 mt-0.5" />
                      <div className="flex flex-wrap gap-1">
                        {request.locations && request.locations.length > 0 ? (
                          request.locations.map(loc => (
                            <span key={loc} className="px-2 py-0.5 bg-white text-blue-700 text-[9px] xs:text-[10px] font-bold rounded-md border border-blue-100 shadow-sm">{loc}</span>
                          ))
                        ) : (
                          <span className="text-xs xs:text-sm font-bold text-gray-700">{request.location}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 bg-green-50/50 p-2.5 rounded-xl border border-green-100/30">
                      <div className="w-4 h-4 bg-green-100 text-green-600 rounded flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-black">₦</span>
                      </div>
                      <span className="text-xs xs:text-sm text-gray-700 font-bold tracking-tight">
                        Budget: <span className="text-gray-900 font-black">
                          {request.min_budget && request.max_budget 
                            ? `₦${request.min_budget.toLocaleString()} - ₦${request.max_budget.toLocaleString()}` 
                            : request.budget_range}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="relative group/text">
                    <p className="text-xs xs:text-sm text-gray-600 leading-relaxed italic border-l-4 border-blue-200 pl-3 xs:pl-4 mb-6 line-clamp-4">
                      &quot;{request.description}&quot;
                    </p>
                  </div>

                  {(role === 'landlord' || role === 'admin') && (
                    <div className="flex flex-col xs:flex-row gap-2.5 xs:gap-3 pt-1">
                      <button 
                        onClick={() => {
                          if (!user?.is_verified && role !== 'admin') {
                            toast.error('Verification Required', {
                              description: 'You must be a verified landlord to contact students.'
                            });
                            return;
                          }
                          setSelectedStudentId(request.student_id);
                          setShowLodgeSelector(true);
                        }}
                        className="flex-[1.5] flex items-center justify-center gap-2 py-3.5 xs:py-4 bg-blue-600 text-white rounded-xl xs:rounded-2xl font-black text-[10px] xs:text-xs uppercase tracking-widest shadow-xl shadow-blue-200 active:scale-95 transition-all hover:bg-blue-700"
                      >
                        <Sparkles size={14} /> I have a match
                      </button>
                      
                      {unlockedRequests[request.id] ? (
                        <button 
                          onClick={() => {
                            if (!user?.is_verified && role !== 'admin') {
                              toast.error('Verification Required', { description: 'You must be a verified landlord to contact students.' });
                              return;
                            }
                            window.open(`https://wa.me/234${unlockedRequests[request.id].substring(1)}?text=Hello ${request.student_name}, I saw your request on ZikLodge for a lodge in ${request.location}. I have something available.`);
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 xs:py-4 bg-white text-green-600 border-2 border-green-50 rounded-xl xs:rounded-2xl font-black text-[10px] xs:text-xs uppercase tracking-widest active:scale-95 transition-all hover:bg-green-50 shadow-sm"
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleUnlock(request)}
                          disabled={unlockingId === request.id}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 xs:py-4 bg-white text-gray-700 border-2 border-gray-100 rounded-xl xs:rounded-2xl font-black text-[10px] xs:text-xs uppercase tracking-widest active:scale-95 transition-all hover:bg-gray-50 shadow-sm"
                        >
                          {unlockingId === request.id ? <Loader2 className="animate-spin" size={14} /> : <Unlock size={14} />}
                          Unlock 
                          <span className="ml-1 text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                            {getUnlockCost(request.max_budget || request.min_budget || 0)} Cr
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        
        {filteredRequests.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-gray-300 border-4 border-white shadow-inner">
              <Search size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No requests found</h3>
            <p className="text-gray-500 text-sm max-w-[250px] mt-2 leading-relaxed">
              We couldn&apos;t find any requests matching your current filters.
            </p>
            {role === 'student' && (
              <Link href="/requests/new" className="mt-8 text-blue-600 font-black text-sm uppercase tracking-widest bg-blue-50 px-8 py-3 rounded-2xl hover:bg-blue-100 transition-colors">
                Post a Request
              </Link>
            )}
            <button onClick={clearFilters} className="mt-4 text-gray-400 font-bold text-xs underline">Clear Filters</button>
          </motion.div>
        )}
      </div>

      {/* Filter Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center p-0 sm:p-4">
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white w-full sm:max-w-md sm:rounded-[32px] rounded-t-[32px] max-h-[90vh] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-50">
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Filter Requests</h2>
              <button onClick={() => setShowFilters(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Location */}
              <section>
                <label className="block text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
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
                    All Locations
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

              {/* Price Range */}
              <section>
                <label className="block text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                  <Banknote size={16} className="text-green-600" /> Budget Range (₦)
                </label>
                <div className="flex gap-4 items-center">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-3 text-gray-400 text-[10px] font-black tracking-widest">MIN</span>
                    <input 
                      type="number" 
                      value={filters.minBudget}
                      onChange={(e) => setFilters({...filters, minBudget: e.target.value})}
                      className="w-full p-3 pt-7 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                      placeholder="0"
                    />
                  </div>
                  <div className="text-gray-300">-</div>
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-3 text-gray-400 text-[10px] font-black tracking-widest">MAX</span>
                    <input 
                      type="number" 
                      value={filters.maxBudget}
                      onChange={(e) => setFilters({...filters, maxBudget: e.target.value})}
                      className="w-full p-3 pt-7 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                      placeholder="∞"
                    />
                  </div>
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
          </motion.div>
        </div>
      )}

      {/* Lodge Selector Modal - Premium Version */}
      <AnimatePresence>
        {showLodgeSelector && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowLodgeSelector(false); setSelectedStudentId(null); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full sm:max-w-md sm:rounded-[40px] rounded-t-[40px] max-h-[85vh] flex flex-col relative z-10 shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center p-8 border-b border-gray-50">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Match Lodge</h2>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Select your property</p>
                </div>
                <button 
                  onClick={() => { setShowLodgeSelector(false); setSelectedStudentId(null); }}
                  className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {landlordLodges.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Sparkles size={32} />
                    </div>
                    <p className="text-gray-900 font-bold mb-2 text-lg">No active listings</p>
                    <p className="text-gray-500 text-sm mb-8 max-w-[200px] mx-auto">You need an available lodge to notify students.</p>
                    <Link href="/post" className="inline-block bg-gray-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-xl">Post a Lodge</Link>
                  </div>
                ) : (
                  landlordLodges.map((lodge) => (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      key={lodge.id}
                      disabled={isNotifying}
                      onClick={() => handleMatchNotify(lodge.id)}
                      className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-3xl transition-all text-left group disabled:opacity-50"
                    >
                      <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-gray-200 shrink-0 border-2 border-white shadow-sm">
                        <Image src={lodge.image_urls[0]} fill className="object-cover group-hover:scale-110 transition-transform duration-500" alt={lodge.title} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate text-base">{lodge.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-blue-600 font-black uppercase tracking-tighter bg-white px-2 py-0.5 rounded border border-blue-100">{lodge.location}</span>
                          <span className="text-[10px] text-gray-400 font-bold">₦{lodge.price.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm border border-gray-100 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        {isNotifying ? <Loader2 className="animate-spin" size={18} /> : <ChevronRight size={20} />}
                      </div>
                    </motion.button>
                  ))
                )}
              </div>
              <div className="p-8 bg-gray-50 border-t border-gray-100">
                 <p className="text-[10px] text-gray-400 text-center font-bold uppercase tracking-widest leading-relaxed">Students will be notified instantly via their dashboard</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
