'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import { Loader2, Save, User, Check } from 'lucide-react';
import { toast } from 'sonner';
import { RoommateHabits } from '@/lib/types';

const INITIAL_HABITS: RoommateHabits = {
  smoke: false,
  cook: true,
  guests: 'weekends',
  study_time: 'flexible',
  cleanliness: 'standard',
  pets: false
};

export default function RoommateProfileSetup() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    gender: 'Male',
    department: '',
    level: '100L',
    habits: INITIAL_HABITS,
    bio: ''
  });

  // Fetch existing profile if editing
  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('roommate_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (data) {
          setFormData({
            gender: data.gender || 'Male',
            department: data.department || '',
            level: data.level || '100L',
            habits: data.habits || INITIAL_HABITS,
            bio: data.bio || ''
          });
        }
      };
      fetchProfile();
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('roommate_profiles')
        .upsert({
          user_id: user.id,
          ...formData,
          updated_at: new Date().toISOString()
        });

      if (error) {
        if (error.message.includes('Privacy Violation')) {
            toast.error('Security Alert: Please remove phone numbers/digits from your bio.');
        } else {
            throw error;
        }
      } else {
        toast.success('Profile updated!');
        router.push('/requests?tab=roommates');
      }
    } catch (err: unknown) {
      toast.error('Failed to save profile');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleHabit = (key: keyof RoommateHabits) => {
    setFormData(prev => ({
      ...prev,
      habits: { ...prev.habits, [key]: !prev.habits[key] }
    }));
  };

  const setHabitValue = (key: keyof RoommateHabits, value: string) => {
    setFormData(prev => ({
      ...prev,
      habits: { ...prev.habits, [key]: value }
    }));
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-white px-6 py-8 pb-24">
      <div className="max-w-lg mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">The Vibe Check</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Tell potential roommates who you are.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basics */}
          <section className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">The Basics</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Gender</label>
                <select 
                  value={formData.gender} 
                  onChange={e => setFormData({...formData, gender: e.target.value})}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Level</label>
                <select 
                  value={formData.level} 
                  onChange={e => setFormData({...formData, level: e.target.value})}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {['100L', '200L', '300L', '400L', '500L', 'PG'].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Department</label>
                <input 
                  type="text" 
                  value={formData.department}
                  onChange={e => setFormData({...formData, department: e.target.value})}
                  placeholder="e.g. Computer Science"
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
          </section>

          {/* Lifestyle */}
          <section className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Lifestyle</h2>
            
            <div className="space-y-3">
               <div className="flex items-center justify-between p-3 border rounded-xl">
                 <span className="text-sm font-bold text-gray-700">Do you smoke?</span>
                 <button type="button" onClick={() => toggleHabit('smoke')} className={`w-12 h-6 rounded-full relative transition-colors ${formData.habits.smoke ? 'bg-red-500' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${formData.habits.smoke ? 'right-1' : 'left-1'}`} />
                 </button>
               </div>

               <div className="flex items-center justify-between p-3 border rounded-xl">
                 <span className="text-sm font-bold text-gray-700">Cooking?</span>
                 <button type="button" onClick={() => toggleHabit('cook')} className={`w-12 h-6 rounded-full relative transition-colors ${formData.habits.cook ? 'bg-green-500' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${formData.habits.cook ? 'right-1' : 'left-1'}`} />
                 </button>
               </div>

               <div>
                 <label className="block text-xs font-bold text-gray-700 mb-2">Guests Policy</label>
                 <div className="grid grid-cols-3 gap-2">
                   {['no_overnight', 'weekends', 'anytime'].map(opt => (
                     <button
                       key={opt}
                       type="button"
                       onClick={() => setHabitValue('guests', opt)}
                       className={`p-2 rounded-lg text-[10px] font-black uppercase tracking-tight border transition-all ${
                         formData.habits.guests === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'
                       }`}
                     >
                       {opt.replace('_', ' ')}
                     </button>
                   ))}
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-bold text-gray-700 mb-2">Study Schedule</label>
                 <div className="grid grid-cols-3 gap-2">
                   {['early_bird', 'flexible', 'night_owl'].map(opt => (
                     <button
                       key={opt}
                       type="button"
                       onClick={() => setHabitValue('study_time', opt)}
                       className={`p-2 rounded-lg text-[10px] font-black uppercase tracking-tight border transition-all ${
                         formData.habits.study_time === opt ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-500 border-gray-200'
                       }`}
                     >
                       {opt.replace('_', ' ')}
                     </button>
                   ))}
                 </div>
               </div>
            </div>
          </section>

          {/* Bio */}
          <section className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">About You</h2>
            <div>
                <textarea 
                  rows={4}
                  value={formData.bio}
                  onChange={e => setFormData({...formData, bio: e.target.value})}
                  placeholder="Describe your vibe. (No phone numbers allowed)"
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm leading-relaxed"
                />
                <p className="text-[10px] text-red-400 font-bold mt-2 flex items-center gap-1">
                   <User size={12} /> Phone numbers are automatically blocked for safety.
                </p>
            </div>
          </section>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Save Profile</>}
          </button>
        </form>
      </div>
    </div>
  );
}
