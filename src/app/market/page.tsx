'use client';

import { useAppContext } from '@/lib/context';
import { useData } from '@/lib/data-context';
import { RequestSkeleton } from '@/components/Skeleton';
import { User, MapPin, Clock, MessageCircle, Trash2, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function MarketRequests() {
  const { role, user, isLoading } = useAppContext();
  const { requests, deleteRequest } = useData();

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
                  <button 
                    onClick={() => handleDeleteRequest(request.id)}
                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin size={16} className="text-blue-500" />
                  <span>Preferred: <strong>{request.location}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px] font-bold">₦</span>
                  <span>Budget: <strong>{request.budget_range}</strong></span>
                </div>
              </div>

              <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl mb-4 italic">
                &quot;{request.description}&quot;
              </p>

              {(role === 'landlord' || role === 'admin') && (
          <button 
            onClick={() => {
              if (request.student_phone) {
                window.open(`https://wa.me/234${request.student_phone.substring(1)}?text=Hello ${request.student_name}, I saw your request on ZikLodge for a lodge in ${request.location}. I have something available.`);
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-100 active:scale-95 transition-transform"
          >
            <MessageCircle size={18} /> Chat on WhatsApp
          </button>
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
    </div>
  );
}
