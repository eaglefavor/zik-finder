'use client';

import { useAppContext } from '@/lib/context';
import { useData } from '@/lib/data-context';
import { RequestSkeleton } from '@/components/Skeleton';
import { User, MapPin, Clock, MessageCircle, Trash2, PlusCircle, CheckCircle, X, Loader2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useState, useMemo } from 'react';

export default function MarketRequests() {
  const { role, user, isLoading } = useAppContext();
  const { requests, deleteRequest, lodges, notifyStudentOfMatch } = useData();
  const [showLodgeSelector, setShowLodgeSelector] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isNotifying, setIsNotifying] = useState(false);

  // Landlord's active lodges
  const landlordLodges = useMemo(() => 
    lodges.filter(l => l.landlord_id === user?.id && l.status === 'available'),
    [lodges, user?.id]
  );

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

  if (isLoading) {
    return (
      <div className="px-4 py-6 pb-24">
        <div className="space-y-4 mb-8">
          <div className="h-8 w-40 bg-gray-200 rounded-lg animate-shimmer" />
          <div className="h-4 w-56 bg-gray-100 rounded-lg animate-shimmer" />
        </div>
        <div className="space-y-4">
          <RequestSkeleton />
          <RequestSkeleton />
          <RequestSkeleton />
        </div>
      </div>
    );
  }

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
      toast.success('Student notified! They will see your lodge in their notifications.');
      setShowLodgeSelector(false);
      setSelectedStudentId(null);
    } else {
      toast.error('Failed to notify student: ' + error);
    }
  };

  return (
    <div className="px-4 py-6 pb-24">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplace</h1>
          <p className="text-sm text-gray-500">Students looking for lodges</p>
        </div>
        {role === 'student' && (
          <Link href="/requests/new" className="p-2 bg-blue-600 text-white rounded-full shadow-lg active:scale-95 transition-transform">
            <PlusCircle size={24} />
          </Link>
        )}
      </header>

      {role === 'student' && !requests.some(r => r.student_id === user?.id) && (
        <div className="bg-blue-50 p-5 rounded-3xl mb-6 border border-blue-100">
          <p className="text-sm text-blue-700 leading-relaxed mb-3">
            Can&apos;t find a lodge? Post a request so landlords can contact you!
          </p>
          <Link href="/requests/new" className="inline-block bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold">
            Create Request
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {requests.map((request) => {
          const isOwnRequest = user?.id === request.student_id;
          
          return (
            <div key={request.id} className={`bg-white p-5 rounded-3xl shadow-sm border ${isOwnRequest ? 'border-blue-200 ring-1 ring-blue-50' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                    <User size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 flex items-center gap-2">
                      {request.student_name}
                      {isOwnRequest && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase">You</span>}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={12} /> {formatTime(request.created_at)}
                    </div>
                  </div>
                </div>
                {isOwnRequest && (
                  <div className="flex gap-1">
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
                      className="px-3 py-1.5 bg-green-50 text-green-600 rounded-xl text-[10px] font-black uppercase border border-green-100 hover:bg-green-100 transition-colors"
                    >
                      Found a Lodge
                    </button>
                    <button 
                      onClick={() => handleDeleteRequest(request.id)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MapPin size={16} className="text-blue-500 shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {request.locations && request.locations.length > 0 ? (
                      request.locations.map(loc => (
                        <span key={loc} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md uppercase border border-blue-100">{loc}</span>
                      ))
                    ) : (
                      <span className="font-bold">{request.location}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px] font-bold shrink-0">₦</span>
                  <span>Budget: <strong>{request.min_budget && request.max_budget ? `₦${request.min_budget.toLocaleString()} - ₦${request.max_budget.toLocaleString()}` : request.budget_range}</strong></span>
                </div>
              </div>

              <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl mb-4 italic">
                &quot;{request.description}&quot;
              </p>

              {(role === 'landlord' || role === 'admin') && (
                <div className="flex gap-2">
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
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-100 active:scale-95 transition-transform"
                  >
                    <CheckCircle size={18} /> I have a match
                  </button>
                  <button 
                    onClick={() => {
                      if (request.student_phone) {
                        window.open(`https://wa.me/234${request.student_phone.substring(1)}?text=Hello ${request.student_name}, I saw your request on ZikLodge for a lodge in ${request.location}. I have something available.`);
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-100 active:scale-95 transition-transform"
                  >
                    <MessageCircle size={18} /> WhatsApp
                  </button>
                </div>
              )}
            </div>
          );
        })}
        
        {requests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-300">
              <User size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No requests yet</h3>
            <p className="text-gray-500 text-sm max-w-[200px] mt-2">Be the first to post a request or check back later.</p>
            {role === 'student' && (
              <Link href="/requests/new" className="mt-6 text-blue-600 font-bold text-sm">Post a Request</Link>
            )}
          </div>
        )}
      </div>

      {/* Lodge Selector Modal */}
      {showLodgeSelector && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-[32px] rounded-t-[32px] max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center p-6 border-b border-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Select your Lodge</h2>
                <p className="text-xs text-gray-500">Which lodge matches this request?</p>
              </div>
              <button 
                onClick={() => { setShowLodgeSelector(false); setSelectedStudentId(null); }}
                className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {landlordLodges.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-500 text-sm mb-4">You don&apos;t have any active listings.</p>
                  <Link href="/post" className="text-blue-600 font-bold text-sm underline">Post a Lodge first</Link>
                </div>
              ) : (
                landlordLodges.map((lodge) => (
                  <button
                    key={lodge.id}
                    disabled={isNotifying}
                    onClick={() => handleMatchNotify(lodge.id)}
                    className="w-full flex items-center gap-4 p-3 bg-gray-50 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-2xl transition-all text-left active:scale-[0.98] disabled:opacity-50"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-200 shrink-0">
                      <img src={lodge.image_urls[0]} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{lodge.title}</p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase">{lodge.location} • ₦{lodge.price.toLocaleString()}</p>
                    </div>
                    {isNotifying ? <Loader2 className="animate-spin text-blue-600" size={16} /> : <ChevronRight className="text-gray-300" size={18} />}
                  </button>
                ))
              )}
            </div>
            <div className="p-6 bg-gray-50 rounded-b-[32px]">
               <p className="text-[10px] text-gray-400 text-center font-medium">The student will receive a notification with a link to your lodge.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
