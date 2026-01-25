'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { Loader2, Edit3, Trash2, PlusCircle, ChevronLeft, MapPin } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { RoommateListing } from '@/lib/types';

export default function ManageListings() {
  const router = useRouter();
  const { user } = useAppContext();
  const [listings, setListings] = useState<RoommateListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchListings = async () => {
      const { data, error } = await supabase
        .from('roommate_listings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        toast.error('Failed to load listings');
      } else {
        setListings(data as unknown as RoommateListing[]);
      }
      setLoading(false);
    };
    fetchListings();
  }, [user]);

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm">
                <ChevronLeft size={20} />
            </button>
            <h1 className="text-2xl font-black text-gray-900">My Listings</h1>
        </div>
        <Link href="/roommate/post" className="p-2 bg-gray-900 text-white rounded-xl shadow-lg">
            <PlusCircle size={20} />
        </Link>
      </header>

      {listings.length === 0 ? (
        <div className="text-center py-20">
            <p className="text-gray-400 font-bold mb-4">You have no active listings.</p>
            <Link href="/roommate/post" className="text-blue-600 font-black uppercase text-xs tracking-widest border-b-2 border-blue-600 pb-1">Create One</Link>
        </div>
      ) : (
        <div className="space-y-4">
            {listings.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <span className={`inline-block px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest mb-2 ${
                                item.type === 'have_room' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                            }`}>
                                {item.type === 'have_room' ? 'Has Room' : 'Seeker'}
                            </span>
                            <h3 className="font-bold text-gray-900 line-clamp-1">{item.description}</h3>
                        </div>
                        <div className="text-right">
                            <span className="block font-black text-blue-600">₦{item.rent_per_person.toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-400 font-bold mb-4">
                        <MapPin size={14} /> {item.location_area}
                    </div>

                    <div className="flex gap-2 border-t border-gray-50 pt-4">
                        <Link href={`/roommate/edit/${item.id}`} className="flex-1 py-2 bg-gray-50 text-gray-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                            <Edit3 size={14} /> Edit
                        </Link>
                        <Link href={`/roommate/${item.id}`} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                            View
                        </Link>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
}
