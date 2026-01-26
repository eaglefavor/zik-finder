'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import LodgeRequestsFeed from '@/components/requests/LodgeRequestsFeed';
import RoommateRequestsFeed from '@/components/requests/RoommateRequestsFeed';
import { Home, Users } from 'lucide-react';

function RequestsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'lodges' | 'roommates'>('lodges');

  useEffect(() => {
    if (tabParam === 'roommates' || tabParam === 'lodges') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (t: 'lodges' | 'roommates') => {
    setActiveTab(t);
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('tab', t);
    router.replace(`/requests?${newParams.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Tab Switcher - Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 py-3 shadow-sm">
        <div className="flex bg-gray-100/50 p-1 rounded-2xl border border-gray-200/50">
          <button
            onClick={() => handleTabChange('lodges')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'lodges' 
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' 
                : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
            }`}
          >
            <Home size={16} /> Find a Lodge
          </button>
          <button
            onClick={() => handleTabChange('roommates')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === 'roommates' 
                ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5' 
                : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
            }`}
          >
            <Users size={16} /> Find Roommate
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-screen">
        {activeTab === 'lodges' ? <LodgeRequestsFeed /> : <RoommateRequestsFeed />}
      </div>
    </div>
  );
}

export default function RequestsPage() {
  return (
    <Suspense>
      <RequestsContent />
    </Suspense>
  );
}