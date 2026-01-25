'use client';

import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, MapPin, Phone, MessageCircle, CheckCircle, Loader2, User, Sparkles, Cigarette, Utensils, Users, BookOpen, Cat, Smile } from 'lucide-react';
import { useAppContext } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { useState, useEffect, useMemo, useRef } from 'react';
import { RoommateListing } from '@/lib/types';
import { toast } from 'sonner';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

const variants = {
  enter: (direction: number) => ({ x: direction > 0 ? 1000 : -1000, opacity: 0 }),
  center: { zIndex: 1, x: 0, opacity: 1 },
  exit: (direction: number) => ({ zIndex: 0, x: direction < 0 ? 1000 : -1000, opacity: 0 })
};

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

export default function RoommateDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAppContext();
  
  const [listing, setListing] = useState<RoommateListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [requesting, setRequesting] = useState(false);

  // Carousel
  const [[page, direction], setPage] = useState([0, 0]);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchListing = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('roommate_listings')
        .select(`
          *,
          profiles:user_id (
            name,
            avatar_url,
            phone_number,
            roommate_profiles:roommate_profiles!roommate_profiles_user_id_fkey (
              gender,
              level,
              department,
              habits,
              bio
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error(error);
        toast.error('Failed to load listing');
      } else {
        setListing(data as unknown as RoommateListing);
      }
      setLoading(false);
    };

    if (id) fetchListing();
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    const checkConnection = async () => {
        const { data } = await supabase
            .from('roommate_connections')
            .select('status')
            .eq('seeker_id', user.id)
            .eq('listing_id', id)
            .maybeSingle();
        
        if (data) {
            setConnectionStatus(data.status as 'pending' | 'accepted');
        }
    };
    checkConnection();
  }, [user, id]);

  const handleRequest = async () => {
    if (!user) { toast.error("Please login"); return; }
    if (!listing) return;
    if (listing.user_id === user.id) { toast.error("You can't pair with yourself"); return; }

    setRequesting(true);
    try {
        const { error } = await supabase
            .from('roommate_connections')
            .insert({
                host_id: listing.user_id,
                seeker_id: user.id,
                listing_id: listing.id,
                status: 'pending',
                seeker_safety_acknowledged: true
            });

        if (error) throw error;
        toast.success('Request sent!');
        setConnectionStatus('pending');
    } catch {
        toast.error('Request failed');
    } finally {
        setRequesting(false);
    }
  };

  const galleryImages = useMemo(() => listing?.images || [], [listing]);
  const imageIndex = Math.abs(page % (galleryImages.length || 1));
  const currentImage = galleryImages[imageIndex];

  const paginate = (newDirection: number) => {
    setPage([page + newDirection, newDirection]);
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (!listing) return <div className="h-screen flex items-center justify-center">Listing not found</div>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rProfile = (listing as any).profiles?.roommate_profiles;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hostProfile = listing.profiles as any;

  return (
    <div className="pb-32 bg-gray-50 min-h-screen">
      {/* Carousel */}
      <div className="relative h-[50vh] bg-gray-900 overflow-hidden" ref={galleryRef}>
        <AnimatePresence initial={false} custom={direction}>
          {galleryImages.length > 0 ? (
            <motion.img
                key={page}
                src={currentImage}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={1}
                onDragEnd={(e, { offset, velocity }: PanInfo) => {
                  const swipe = swipePower(offset.x, velocity.x);
                  if (swipe < -swipeConfidenceThreshold) paginate(1);
                  else if (swipe > swipeConfidenceThreshold) paginate(-1);
                }}
                className="absolute w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
                <User size={64} className="text-gray-400" />
            </div>
          )}
        </AnimatePresence>
        
        <div className="absolute top-0 left-0 right-0 p-4 pt-6 flex justify-between items-center z-20">
          <button onClick={() => router.back()} className="p-3 bg-black/20 backdrop-blur-xl rounded-full text-white hover:bg-black/30 transition-colors">
            <ChevronLeft size={24} />
          </button>
        </div>

        {galleryImages.length > 1 && (
            <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-md">
                {imageIndex + 1} / {galleryImages.length}
            </div>
        )}
      </div>

      <div className="px-5 py-8 -mt-10 bg-gray-50 rounded-t-[40px] relative z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] min-h-[50vh]">
         {/* Title / Price */}
         <div className="flex justify-between items-start mb-6">
            <div>
                <div className={`inline-flex items-center gap-2 px-3 py-1 mb-3 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                    listing.type === 'have_room' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                }`}>
                    {listing.type === 'have_room' ? 'Has Room' : 'Needs Room'}
                </div>
                <h1 className="text-2xl font-black text-gray-900 leading-tight">
                    {hostProfile?.name || 'Student'}
                </h1>
                <div className="text-sm text-gray-500 font-bold mt-1">
                    {rProfile?.level} • {rProfile?.department}
                </div>
            </div>
            <div className="text-right">
                <div className="text-2xl font-black text-blue-600">
                    ₦{listing.rent_per_person.toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                    {listing.payment_period === 'Yearly' ? '/ Year' : '/ Sem'}
                </div>
            </div>
         </div>

         {/* Location */}
         <div className="flex items-center gap-2 mb-8 bg-white p-3 rounded-2xl shadow-sm border border-gray-100 w-fit">
            <MapPin size={18} className="text-blue-500" />
            <span className="text-sm font-bold text-gray-700">{listing.location_area}{listing.landmark ? `, ${listing.landmark}` : ''}</span>
         </div>

         {/* Bio */}
         <section className="mb-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-3">The Vibe</h2>
            <p className="text-sm text-gray-600 leading-relaxed font-medium bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                &quot;{listing.description}&quot;
            </p>
            {rProfile?.bio && (
                <div className="mt-4">
                    <h3 className="text-xs font-bold text-gray-900 mb-2">Personal Bio</h3>
                    <p className="text-sm text-gray-500 italic">
                        {rProfile.bio}
                    </p>
                </div>
            )}
         </section>

         {/* Habits */}
         {rProfile?.habits && (
             <section className="mb-24">
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Lifestyle</h2>
                <div className="grid grid-cols-2 gap-3">
                    <HabitItem icon={Cigarette} label="Smoking" value={rProfile.habits.smoke ? 'Smoker' : 'Non-Smoker'} active={!rProfile.habits.smoke} />
                    <HabitItem icon={Utensils} label="Cooking" value={rProfile.habits.cook ? 'Cooks' : 'No Cooking'} active={rProfile.habits.cook} />
                    <HabitItem icon={Users} label="Guests" value={rProfile.habits.guests.replace('_', ' ')} active={true} />
                    <HabitItem icon={BookOpen} label="Study" value={rProfile.habits.study_time.replace('_', ' ')} active={true} />
                    <HabitItem icon={Cat} label="Pets" value={rProfile.habits.pets ? 'Has Pets' : 'No Pets'} active={!rProfile.habits.pets} />
                    <HabitItem icon={Smile} label="Cleanliness" value={rProfile.habits.cleanliness} active={true} />
                </div>
             </section>
         )}
      </div>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-50 shadow-2xl">
        {connectionStatus === 'accepted' ? (
             <div className="flex gap-3">
                <button onClick={() => window.location.href=`tel:${hostProfile?.phone_number}`} className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
                    <Phone size={20} /> Call
                </button>
                <button onClick={() => window.open(`https://wa.me/234${hostProfile?.phone_number?.substring(1)}`)} className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
                    <MessageCircle size={20} /> WhatsApp
                </button>
             </div>
        ) : (
            <button 
                onClick={handleRequest}
                disabled={requesting || connectionStatus === 'pending'}
                className={`w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${
                    connectionStatus === 'pending' 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-blue-600 text-white active:scale-95 shadow-blue-200'
                }`}
            >
                {requesting ? <Loader2 className="animate-spin" /> : connectionStatus === 'pending' ? <CheckCircle /> : <Sparkles />}
                {connectionStatus === 'pending' ? 'Request Sent' : 'Request to Pair'}
            </button>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function HabitItem({ icon: Icon, label, value, active }: any) {
    return (
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${active ? 'bg-white border-gray-100' : 'bg-gray-50 border-transparent opacity-50'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-400'}`}>
                <Icon size={16} />
            </div>
            <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-xs font-black text-gray-900 capitalize">{value}</p>
            </div>
        </div>
    );
}
