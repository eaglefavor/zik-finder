'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2, ChevronLeft, X, Loader2, ShieldAlert, RefreshCw, Plus, Trash2, Share2, Eye, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useData } from '@/lib/data-context';
import { useAppContext } from '@/lib/context';
import { supabase } from '@/lib/supabase';
import Compressor from 'compressorjs';
import { toast } from 'sonner';

import { ROOM_TYPE_PRESETS, AREA_LANDMARKS } from '@/lib/constants';

// Cloudinary Configuration
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;

const DRAFT_KEY = 'zik_lodge_post_draft';

export default function PostLodge() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const unitFileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const { addLodge } = useData();
  const { user, role, isLoading, refreshProfile } = useAppContext();
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [newlyCreatedLodgeId, setNewlyCreatedLodgeId] = useState<string | null>(null);
  
  // Step 1: Basic Info
  const [formData, setFormData] = useState({
    title: '',
    location: 'Ifite',
    landmark: 'School Gate',
    address: '',
    description: '',
    amenities: [] as string[]
  });

  interface TempUnit {
    tempId: string;
    name: string;
    price: number;
    total_units: number;
    image_urls: string[];
  }

  const [generalImages, setGeneralImages] = useState<string[]>([]);
  const [units, setUnits] = useState<TempUnit[]>([]);
  const [newUnit, setNewUnit] = useState({
    name: '',
    price: '',
    total_units: '1'
  });
  const [showCustomType, setShowCustomType] = useState(false);

  // --- Persistence Logic ---
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const { formData: dForm, generalImages: dImgs, units: dUnits } = JSON.parse(savedDraft);
        
        // Only prompt if the draft has actual content (substantial)
        const isSubstantial = dForm.title.trim() !== '' || dImgs.length > 0 || dUnits.length > 0;
        
        if (isSubstantial) {
          toast.info('You have an unfinished draft', {
            description: 'Would you like to resume where you left off?',
            action: {
              label: 'Resume',
              onClick: () => {
                setFormData(dForm);
                setGeneralImages(dImgs);
                setUnits(dUnits);
              }
            },
            cancel: {
              label: 'Discard',
              onClick: () => localStorage.removeItem(DRAFT_KEY)
            }
          });
        } else {
          // Silent cleanup for empty drafts
          localStorage.removeItem(DRAFT_KEY);
        }
      } catch (err) {
        console.error('Failed to parse draft', err);
      }
    }
  }, []);

  useEffect(() => {
    // Save draft periodically, but NOT if we are in the success state
    if (!isSubmitted && newlyCreatedLodgeId === null) {
      const isSubstantial = formData.title.trim() !== '' || generalImages.length > 0 || units.length > 0;
      if (isSubstantial) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, generalImages, units }));
      }
    }
  }, [formData, generalImages, units, isSubmitted, newlyCreatedLodgeId]);

  const handleAreaChange = (area: string) => {
    setFormData({
      ...formData, 
      location: area, 
      landmark: AREA_LANDMARKS[area][0] 
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      new Compressor(file, {
        quality: 0.6,
        maxWidth: 1200,
        success(result) {
          resolve(result as File);
        },
        error(err) {
          reject(err);
        },
      });
    });
  };

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: data,
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.secure_url;
  };

  const handleGeneralImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const urls = await Promise.all(Array.from(files).map(async (file) => {
        const compressed = await compressImage(file);
        return uploadToCloudinary(compressed);
      }));
      setGeneralImages(prev => [...prev, ...urls]);
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUnitImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, tempId: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const urls = await Promise.all(Array.from(files).map(async (file) => {
        const compressed = await compressImage(file);
        return uploadToCloudinary(compressed);
      }));
      setUnits(prev => prev.map(u => u.tempId === tempId ? { ...u, image_urls: [...u.image_urls, ...urls] } : u));
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAddUnit = () => {
    if (!newUnit.name || !newUnit.price) return;
    setUnits([...units, {
      tempId: Date.now().toString(),
      name: newUnit.name,
      price: parseInt(newUnit.price),
      total_units: parseInt(newUnit.total_units) || 1,
      image_urls: []
    }]);
    setNewUnit({ name: '', price: '', total_units: '1' });
    setShowCustomType(false);
  };

  const handleDeleteUnit = (tempId: string) => {
    setUnits(units.filter(u => u.tempId !== tempId));
  };

  const toggleAmenity = (item: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(item) ? prev.amenities.filter(i => i !== item) : [...prev.amenities, item]
    }));
  };

  const handleSubmit = async () => {
    if (!user) return;
    setUploading(true);
    
    // Prepare units for DB
    const finalUnits = units.map(u => ({
      name: u.name,
      price: u.price,
      total_units: u.total_units,
      available_units: u.total_units,
      image_urls: u.image_urls
    }));

    const minPrice = units.length > 0 ? Math.min(...units.map(u => u.price)) : 0;
    const fullDescription = `Landmark: ${formData.landmark}\nAddress: ${formData.address}\n\n${formData.description}`;

    const { success, error } = await addLodge({
      title: formData.title,
      price: minPrice,
      location: formData.location,
      description: fullDescription,
      image_urls: generalImages.length > 0 ? generalImages : ['https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg'],
      amenities: formData.amenities,
      status: 'available',
    }, finalUnits);

    if (success) {
      // Clear draft
      localStorage.removeItem(DRAFT_KEY);
      
      // Get the ID of the newly created lodge (we fetch it based on landlord_id and title)
      const { data } = await supabase.from('lodges').select('id').eq('landlord_id', user.id).eq('title', formData.title).order('created_at', { ascending: false }).limit(1).single();
      
      if (data) setNewlyCreatedLodgeId(data.id);

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Lodge Published! 🎉',
        message: `Your lodge "${formData.title}" is now live and visible to students.`, 
        type: 'success',
        link: data ? `/lodge/${data.id}` : '/profile'
      });
      
      setIsSubmitted(true);
    } else {
      toast.error('Error saving lodge: ' + error);
    }
    setUploading(false);
  };

  const shareToWhatsApp = () => {
    const url = `${window.location.origin}/lodge/${newlyCreatedLodgeId}`;
    const text = `Check out my new lodge on ZikLodge: ${formData.title}\n\nView here: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  if (!user?.is_verified && role !== 'admin') {
    return (
      <div className="px-4 py-6 flex flex-col items-center justify-center h-[80vh] text-center">
        <ShieldAlert className="text-red-500 mb-6" size={40} />
        <h1 className="text-2xl font-bold mb-3">Verification Required</h1>
        <div className="space-y-3 w-full max-w-xs">
          <button onClick={handleRefresh} disabled={refreshing} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2">
            {refreshing ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />} Check Status
          </button>
          <Link href="/profile" className="block w-full py-4 bg-blue-50 text-blue-600 rounded-2xl font-bold text-center">Go to Profile</Link>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-8">
          <CheckCircle size={64} />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-4">Lodge Published!</h1>
        <p className="text-gray-500 mb-10 max-w-xs mx-auto text-lg">
          Congratulations! Your listing is now live and students can contact you.
        </p>
        
        <div className="w-full max-w-xs space-y-4">
          <button 
            onClick={() => router.push(`/lodge/${newlyCreatedLodgeId}`)}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
          >
            <Eye size={20} /> View My Listing
          </button>
          <button 
            onClick={shareToWhatsApp}
            className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
          >
            <Share2 size={20} /> Share to WhatsApp
          </button>
          <button 
            onClick={() => router.push('/')}
            className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold active:scale-95 transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 pb-32 max-w-2xl mx-auto">
      <header className="flex items-center gap-4 mb-8">
        <Link href="/" className="p-2 bg-white rounded-full shadow-sm border border-gray-100"><ChevronLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Post a Lodge</h1>
          <p className="text-xs text-gray-500 font-medium text-blue-600 uppercase tracking-widest">Step {step} of 3</p>
        </div>
      </header>

      <div className="mb-10">
        <div className="flex justify-between mb-2">
          {['Basic Info', 'Room Vacancy', 'Media Upload'].map((label, i) => (
            <span key={label} className={`text-[10px] font-black uppercase tracking-widest ${i + 1 <= step ? 'text-blue-600' : 'text-gray-300'}`}>{label}</span>
          ))}
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-blue-600 shadow-sm shadow-blue-100' : 'bg-gray-100'}`} />
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 px-1 text-blue-600">Lodge Name</label>
              <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Divine Grace Lodge" className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-medium" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 px-1 text-blue-600">Area</label>
                <select 
                  value={formData.location} 
                  onChange={e => handleAreaChange(e.target.value)} 
                  className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm appearance-none font-medium"
                >
                  {Object.keys(AREA_LANDMARKS).map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 px-1 text-blue-600">Landmark</label>
                <select 
                  value={formData.landmark} 
                  onChange={e => setFormData({...formData, landmark: e.target.value})} 
                  className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm appearance-none font-medium"
                >
                  {AREA_LANDMARKS[formData.location].map(landmark => (
                    <option key={landmark} value={landmark}>{landmark}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 px-1 text-blue-600">Detailed Address / Street</label>
              <input 
                type="text" 
                value={formData.address} 
                onChange={e => setFormData({...formData, address: e.target.value})} 
                placeholder="e.g. No 15, Amoka Street" 
                className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-medium" 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 px-1 text-blue-600">Short Description</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Tell students more about the neighborhood..." className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-medium" rows={3} />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 px-1 text-blue-600">Select Amenities</label>
              <div className="grid grid-cols-2 gap-3">
                {['Water', 'Light', 'Security', 'Prepaid', 'Parking', 'Tiled'].map(item => (
                  <div key={item} onClick={() => toggleAmenity(item)} className={`flex items-center justify-between p-4 border rounded-2xl cursor-pointer transition-colors ${formData.amenities.includes(item) ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                    <span className={`text-sm font-bold ${formData.amenities.includes(item) ? 'text-blue-700' : 'text-gray-600'}`}>{item}</span>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${formData.amenities.includes(item) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>{formData.amenities.includes(item) && <CheckCircle2 size={14} className="text-white" />}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button onClick={() => setStep(2)} disabled={!formData.title || !formData.address} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform">Continue: Room Vacancy</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
          <div className="space-y-4">
            {units.map((unit) => (
              <div key={unit.tempId} className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{unit.name}</h3>
                    <p className="text-blue-600 font-black">₦{unit.price.toLocaleString()} • {unit.total_units} Room(s)</p>
                  </div>
                  <button onClick={() => handleDeleteUnit(unit.tempId)} className="p-2 text-red-400 bg-red-50 rounded-full hover:bg-red-100 transition-colors"><Trash2 size={18} /></button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {unit.image_urls.map((img, i) => <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100"><img src={img} className="w-full h-full object-cover" alt="" /><button onClick={() => setUnits(prev => prev.map(u => u.tempId === unit.tempId ? {...u, image_urls: u.image_urls.filter((_, idx) => idx !== i)} : u))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5"><X size={10} /></button></div>)}
                  {unit.image_urls.length < 4 && (
                    <div onClick={() => unitFileInputRefs.current[unit.tempId]?.click()} className="aspect-square border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-50 transition-colors">
                      {uploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                      <input type="file" multiple accept="image/*" className="hidden" ref={(el) => { unitFileInputRefs.current[unit.tempId] = el; }} onChange={(e) => handleUnitImageUpload(e, unit.tempId)} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 p-6 rounded-[32px] space-y-4 border border-blue-50 shadow-inner">
            <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest px-1">Add a Vacancy Type</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Room Category</label>
                <select 
                  className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-sm outline-none focus:border-blue-500 appearance-none shadow-sm font-bold"
                  value={showCustomType ? 'custom' : newUnit.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') { setShowCustomType(true); setNewUnit({ ...newUnit, name: '' }); }
                    else { setShowCustomType(false); setNewUnit({ ...newUnit, name: val }); }
                  }}
                >
                  <option value="" disabled>Select Room Type...</option>
                  {ROOM_TYPE_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
                  <option value="custom">Other / Describe Yours</option>
                </select>
              </div>

              {showCustomType && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Custom Room Name</label>
                  <input type="text" placeholder="e.g. Master Bedroom Apartment" value={newUnit.name} onChange={e => setNewUnit({...newUnit, name: e.target.value})} className="w-full p-4 bg-white border border-blue-200 rounded-2xl text-sm outline-none shadow-sm font-bold" autoFocus />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Price (₦)</label>
                  <div className="relative"><span className="absolute left-3 top-3.5 text-gray-400 text-sm font-bold">₦</span><input type="number" placeholder="per year" value={newUnit.price} onChange={e => setNewUnit({...newUnit, price: e.target.value})} className="w-full p-4 pl-7 bg-white border border-gray-200 rounded-2xl text-sm outline-none focus:border-blue-500 shadow-sm font-bold" /></div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Number of Rooms</label>
                  <input type="number" placeholder="Qty" value={newUnit.total_units} onChange={e => setNewUnit({...newUnit, total_units: e.target.value})} className="w-full p-4 bg-white border border-gray-200 rounded-2xl text-sm outline-none focus:border-blue-500 shadow-sm text-center font-bold" />
                </div>
              </div>
              <button type="button" onClick={handleAddUnit} disabled={!newUnit.name || !newUnit.price} className="w-full py-4 bg-blue-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50 active:scale-95 transition-transform"><Plus size={20} /> Add this Room</button>
            </div>
          </div>

          <div className="flex gap-4"><button onClick={() => setStep(1)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold">Back</button><button onClick={() => setStep(3)} disabled={units.length === 0} className="flex-2 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 disabled:opacity-50">Continue: Media</button></div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right duration-300">
          <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-2">Lodge Photo Gallery</h3>
            <p className="text-sm text-gray-500 mb-6">Upload general photos of the compound, gate, and hallway.</p>
            <div className="grid grid-cols-3 gap-3">
              {generalImages.map((img, i) => <div key={i} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100"><img src={img} className="w-full h-full object-cover" alt="" /><button onClick={() => setGeneralImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X size={12} /></button></div>)}
              {generalImages.length < 10 && (
                <div onClick={() => fileInputRef.current?.click()} className="aspect-square border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-50 transition-all active:scale-95">
                  {uploading ? <Loader2 className="animate-spin" size={24} /> : <><Camera size={24} /><span className="text-[10px] font-bold">ADD PHOTO</span></>}
                  <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleGeneralImageUpload} />
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-4 pt-4"><button onClick={() => setStep(2)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold">Back</button><button onClick={handleSubmit} disabled={uploading} className="flex-2 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 disabled:opacity-50">{uploading ? 'Publishing Lodge...' : 'Publish Listing'}</button></div>
        </div>
      )}
    </div>
  );
}