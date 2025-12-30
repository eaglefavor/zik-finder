'use client';

import { useAppContext } from '@/lib/context';
import { useData } from '@/lib/data-context';
import { RequestSkeleton } from '@/components/Skeleton';
import { User, MapPin, Clock, MessageCircle, Trash2, PlusCircle, CheckCircle, X, Loader2, ChevronRight, Search, Filter, Sparkles, Send } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MarketRequests() {
  const { role, user, isLoading } = useAppContext();
  const { requests, deleteRequest, lodges, notifyStudentOfMatch } = useData();
  const [showLodgeSelector, setShowLodgeSelector] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isNotifying, setIsNotifying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Landlord's active lodges
  const landlordLodges = useMemo(() => 
    lodges.filter(l => l.landlord_id === user?.id && l.status === 'available'),
    [lodges, user?.id]
  );

  const filteredRequests = useMemo(() => {
    return requests.filter(r => 
      r.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.locations?.some(loc => loc.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [requests, searchQuery]);

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
      {/* Premium Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-8 sticky top-0 z-30 shadow-sm shadow-gray-100/50 backdrop-blur-xl bg-white/80">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              Marketplace <Sparkles className="text-blue-500 fill-blue-500" size={20} />
            </h1>
            <p className="text-sm text-gray-500 font-medium mt-1">Connect with students looking for lodges</p>
          </div>
          {role === 'student' && (
            <Link 
              href="/requests/new" 
              className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all hover:bg-blue-700 group"
            >
              <PlusCircle size={24} className="group-hover:rotate-90 transition-transform duration-300" />
            </Link>
          )}
        </div>

        {/* Modern Search Bar */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Search by area, budget or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 p-4 pl-12 rounded-2xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-medium text-sm"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Post CTA for Students */}
        {role === 'student' && !requests.some(r => r.student_id === user?.id) && !searchQuery && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-[32px] text-white shadow-xl shadow-blue-200 relative overflow-hidden"
          >
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-2">Can&apos;t find a lodge?</h3>
              <p className="text-blue-50 text-sm leading-relaxed mb-4 opacity-90">
                Post your specific requirements and let landlords reach out to you with matching listings!
              </p>
              <Link 
                href="/requests/new" 
                className="inline-flex items-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-2xl text-sm font-black shadow-lg active:scale-95 transition-all"
              >
                Create Request <Send size={16} />
              </Link>
            </div>
            <PlusCircle className="absolute -bottom-4 -right-4 w-32 h-32 text-white/10 rotate-12" />
          </motion.div>
        )}

        {/* Requests List */}
        <div className="space-y-4">
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
                  className={`bg-white p-6 rounded-[32px] shadow-sm border transition-all ${
                    isOwnRequest 
                      ? 'border-blue-200 ring-4 ring-blue-500/5' 
                      : 'border-gray-100 hover:border-blue-100 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl flex items-center justify-center text-gray-400 border border-gray-100">
                        <User size={24} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 flex items-center gap-2 text-lg">
                          {request.student_name}
                          {isOwnRequest && (
                            <span className="text-[10px] bg-blue-600 text-white px-2.5 py-1 rounded-full uppercase font-black tracking-widest">You</span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1.5 font-black uppercase tracking-widest">
                          <Clock size={12} className="text-blue-500" /> {formatTime(request.created_at)}
                        </div>
                      </div>
                    </div>
                    {isOwnRequest && (
                      <div className="flex gap-2">
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
                          className="px-4 py-2 bg-green-50 text-green-600 rounded-xl text-[10px] font-black uppercase border border-green-100 hover:bg-green-100 transition-all active:scale-95"
                        >
                          Found it
                        </button>
                        <button 
                          onClick={() => handleDeleteRequest(request.id)}
                          className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Requirements Section */}
                  <div className="grid grid-cols-1 gap-3 mb-6 bg-gray-50/50 p-4 rounded-2xl border border-gray-100/50">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                        <MapPin size={16} />
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {request.locations && request.locations.length > 0 ? (
                          request.locations.map(loc => (
                            <span key={loc} className="px-2.5 py-1 bg-white text-blue-700 text-[10px] font-bold rounded-lg border border-blue-100 shadow-sm">{loc}</span>
                          ))
                        ) : (
                          <span className="text-sm font-bold text-gray-700">{request.location}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-xs font-black">₦</span>
                      </div>
                      <span className="text-sm text-gray-700 font-bold tracking-tight">
                        Budget: <span className="text-gray-900 font-black">
                          {request.min_budget && request.max_budget 
                            ? `₦${request.min_budget.toLocaleString()} - ₦${request.max_budget.toLocaleString()}` 
                            : request.budget_range}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="relative group/text">
                    <p className="text-sm text-gray-600 leading-relaxed italic border-l-4 border-blue-200 pl-4 mb-6">
                      &quot;{request.description}&quot;
                    </p>
                  </div>

                  {(role === 'landlord' || role === 'admin') && (
                    <div className="flex gap-3 pt-2">
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
                        className="flex-[1.5] flex items-center justify-center gap-2 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 active:scale-95 transition-all hover:bg-blue-700"
                      >
                        <Sparkles size={16} /> I have a match
                      </button>
                      <button 
                        onClick={() => {
                          if (request.student_phone) {
                            window.open(`https://wa.me/234${request.student_phone.substring(1)}?text=Hello ${request.student_name}, I saw your request on ZikLodge for a lodge in ${request.location}. I have something available.`);
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-4 bg-white text-green-600 border-2 border-green-50 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all hover:bg-green-50 shadow-sm"
                      >
                        <MessageCircle size={16} /> WhatsApp
                      </button>
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
              We couldn&apos;t find any requests matching your current search.
            </p>
            {role === 'student' && (
              <Link href="/requests/new" className="mt-8 text-blue-600 font-black text-sm uppercase tracking-widest bg-blue-50 px-8 py-3 rounded-2xl hover:bg-blue-100 transition-colors">
                Post a Request
              </Link>
            )}
          </motion.div>
        )}
      </div>

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
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-200 shrink-0 border-2 border-white shadow-sm">
                        <img src={lodge.image_urls[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
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
