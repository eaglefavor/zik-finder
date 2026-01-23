'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { Loader2, Camera, MapPin, X, ChevronLeft, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFileResumable } from '@/lib/tus-upload';
import Image from 'next/image';
import { AREA_LANDMARKS } from '@/lib/constants';

export default function PostRoommateAd() {
  const router = useRouter();
  const { user } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    type: 'have_room',
    location: 'Ifite',
    landmark: '',
    rent: '',
    description: '',
    images: [] as string[]
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploading(true);
    try {
      const results = await Promise.all(Array.from(files).map(async (file) => {
        const filePath = `${user.id}/roommate-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        return await uploadFileResumable('lodge-images', filePath, file);
      }));
      setFormData(prev => ({ ...prev, images: [...prev.images, ...results] }));
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
        // 1. Check if user has a profile
        const { data: profile } = await supabase
            .from('roommate_profiles')
            .select('user_id')
            .eq('user_id', user.id)
            .single();
        
        if (!profile) {
            toast.error('Please complete your Vibe Check profile first!');
            router.push('/roommate/setup');
            return;
        }

        // 2. Create Listing
        const { error } = await supabase
            .from('roommate_listings')
            .insert({
                user_id: user.id,
                type: formData.type,
                location_area: formData.location,
                landmark: formData.landmark,
                rent_per_person: parseInt(formData.rent),
                description: formData.description,
                images: formData.images,
                status: 'active'
            });

        if (error) {
             if (error.message.includes('Privacy Violation')) {
                toast.error('Security Alert: Please remove phone numbers from description.');
            } else {
                throw error;
            }
        } else {
            toast.success('Ad posted successfully!');
            router.push('/roommate');
        }
    } catch (err) {
        console.error(err);
        toast.error('Failed to post ad');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-6 py-6 pb-24">
        <header className="flex items-center gap-4 mb-8">
            <button onClick={() => router.back()} className="p-2 bg-gray-50 rounded-full">
                <ChevronLeft size={20} />
            </button>
            <h1 className="text-2xl font-black text-gray-900">Post Room</h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Type Selector */}
            <div className="flex bg-gray-50 p-1.5 rounded-2xl">
                <button
                    type="button"
                    onClick={() => setFormData({...formData, type: 'have_room'})}
                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        formData.type === 'have_room' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'
                    }`}
                >
                    I Have a Room
                </button>
                <button
                    type="button"
                    onClick={() => setFormData({...formData, type: 'need_room'})}
                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        formData.type === 'need_room' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'
                    }`}
                >
                    I Need a Room
                </button>
            </div>

            {/* Location */}
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Area</label>
                    <div className="flex flex-wrap gap-2">
                        {Object.keys(AREA_LANDMARKS).map(area => (
                            <button
                                key={area}
                                type="button"
                                onClick={() => setFormData({...formData, location: area, landmark: AREA_LANDMARKS[area][0]})}
                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                                    formData.location === area 
                                        ? 'bg-blue-600 text-white border-blue-600' 
                                        : 'bg-white text-gray-500 border-gray-200'
                                }`}
                            >
                                {area}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Nearest Landmark</label>
                    <select 
                        value={formData.landmark}
                        onChange={e => setFormData({...formData, landmark: e.target.value})}
                        className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none text-sm font-bold appearance-none"
                    >
                        {AREA_LANDMARKS[formData.location].map(lm => (
                            <option key={lm} value={lm}>{lm}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Financials */}
            <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                    {formData.type === 'have_room' ? 'Rent Share Amount (₦)' : 'Max Budget (₦)'}
                </label>
                <input 
                    type="number" 
                    value={formData.rent}
                    onChange={e => setFormData({...formData, rent: e.target.value})}
                    placeholder="e.g. 150000"
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none font-black text-lg"
                />
            </div>

            {/* Photos */}
            {formData.type === 'have_room' && (
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Room Photos</label>
                    <div className="grid grid-cols-3 gap-3">
                        {formData.images.map((img, i) => (
                            <div key={i} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden">
                                <Image src={img} fill className="object-cover" alt="" />
                                <button type="button" onClick={() => setFormData(p => ({...p, images: p.images.filter((_, idx) => idx !== i)}))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X size={12}/></button>
                            </div>
                        ))}
                        <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 cursor-pointer">
                            {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
                            <input type="file" multiple className="hidden" onChange={handleImageUpload} />
                        </label>
                    </div>
                </div>
            )}

            {/* Description */}
            <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Description</label>
                <textarea 
                    rows={4}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder={formData.type === 'have_room' ? "Describe the room and house rules..." : "Describe what kind of room you want..."}
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none outline-none text-sm leading-relaxed"
                />
            </div>

            <button 
                type="submit" 
                disabled={loading || uploading}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" /> : <><Building2 size={20} /> Post Ad</>}
            </button>
        </form>
    </div>
  );
}
