'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, MapPin, CheckCircle2, ChevronLeft, X, Loader2, ShieldAlert, RefreshCw, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { useData } from '@/lib/data-context';
import { useAppContext } from '@/lib/context';
import Compressor from 'compressorjs';

// Cloudinary Configuration
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;

const ROOM_TYPE_PRESETS = [
  'Standard Self-con',
  'Executive Self-con',
  'Studio Apartment',
  'Single Room',
  'Face-Me-I-Face-You',
  '1-Bedroom Flat',
  '2-Bedroom Flat',
  '3-Bedroom Flat',
  'Penthouse',
  'Basement Room'
];

export default function PostLodge() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const unitFileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const { addLodge } = useData();
  const { user, role, isLoading, refreshProfile } = useAppContext();
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Step 1: Basic Info
  const [formData, setFormData] = useState({
    title: '',
    location: 'Ifite',
    description: '',
    amenities: [] as string[]
  });

  // Step 2: Units (Room Categories)
  interface TempUnit {
    tempId: string;
    name: string;
    price: number;
    image_urls: string[];
  }

  const [generalImages, setGeneralImages] = useState<string[]>([]);
  const [units, setUnits] = useState<TempUnit[]>([]);
  
  const [newUnit, setNewUnit] = useState({
    name: '',
    price: '',
  });
  const [showCustomType, setShowCustomType] = useState(false);

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
        success(result) { resolve(result as File); },
        error(err) { reject(err); },
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
      alert('Upload failed');
    } finally {
      setUploading(false);
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
      alert('Upload failed');
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
      image_urls: []
    }]);
    setNewUnit({ name: '', price: '' });
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
    const finalUnits = units.map(u => ({
      name: u.name,
      price: u.price,
      total_units: 1,
      available_units: 1,
      image_urls: u.image_urls
    }));
    const minPrice = units.length > 0 ? Math.min(...units.map(u => u.price)) : 0;
    const { success, error } = await addLodge({
      title: formData.title,
      price: minPrice,
      location: formData.location,
      description: formData.description || 'No description provided.',
      image_urls: generalImages.length > 0 ? generalImages : ['https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg'],
      amenities: formData.amenities,
      status: 'available',
    }, finalUnits);
    if (success) router.push('/'); else alert('Error: ' + error);
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
          <Link href="/profile" className="block w-full py-4 bg-blue-50 text-blue-600 rounded-2xl font-bold text-center">Profile</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 pb-32 max-w-2xl mx-auto">
      <header className="flex items-center gap-4 mb-8">
        <Link href="/" className="p-2 bg-white rounded-full shadow-sm border border-gray-100"><ChevronLeft size={20} /></Link>
        <div><h1 className="text-2xl font-bold">Post a Lodge</h1><p className="text-xs text-gray-500 font-medium text-blue-600 uppercase tracking-widest">Step {step} of 3</p></div>
      </header>

      <div className="mb-10 flex gap-2">
        {[1, 2, 3].map(i => <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-blue-600 shadow-sm shadow-blue-100' : 'bg-gray-100'}`} />)}
      </div>

      {step === 1 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
          <div><label className="block text-sm font-bold text-gray-700 mb-2">Lodge Name</label><input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Divine Grace Lodge" className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          <div><label className="block text-sm font-bold text-gray-700 mb-2">Location</label><select value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"><option value="Ifite">Ifite</option><option value="Amansea">Amansea</option><option value="Temp Site">Temp Site</option><option value="Okpuno">Okpuno</option></select></div>
          <div><label className="block text-sm font-bold text-gray-700 mb-2">Description</label><textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Landmarks, neighborhood details..." className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" rows={3} /></div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">General Amenities</label>
            <div className="grid grid-cols-2 gap-3">
              {['Water', 'Light', 'Security', 'Prepaid', 'Parking', 'Tiled'].map(item => (
                <div key={item} onClick={() => toggleAmenity(item)} className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors ${formData.amenities.includes(item) ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-100'}`}>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${formData.amenities.includes(item) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>{formData.amenities.includes(item) && <CheckCircle2 size={14} className="text-white" />}</div>
                  <span className="text-sm text-gray-600">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => setStep(2)} disabled={!formData.title} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200">Next: Rooms</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
          <div className="space-y-4">
            {units.map(unit => (
              <div key={unit.tempId} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div><h3 className="font-bold text-lg">{unit.name}</h3><p className="text-blue-600 font-black">₦{unit.price.toLocaleString()}</p></div>
                  <button onClick={() => handleDeleteUnit(unit.tempId)} className="p-2 text-red-400 bg-red-50 rounded-full hover:bg-red-100 transition-colors"><Trash2 size={18} /></button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {unit.image_urls.map((img, i) => <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100"><img src={img} className="w-full h-full object-cover" alt="" /><button onClick={() => setUnits(prev => prev.map(u => u.tempId === unit.tempId ? {...u, image_urls: u.image_urls.filter((_, idx) => idx !== i)} : u))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5"><X size={10} /></button></div>)}
                  {unit.image_urls.length < 4 && (
                    <div onClick={() => unitFileInputRefs.current[unit.tempId]?.click()} className="aspect-square border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-50 transition-colors">
                      {uploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                      <input type="file" multiple accept="image/*" className="hidden" ref={el => unitFileInputRefs.current[unit.tempId] = el} onChange={e => handleUnitImageUpload(e, unit.tempId)} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 p-5 rounded-[32px] space-y-4 border border-blue-50">
            <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest px-1">Add a Vacancy</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {ROOM_TYPE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => { setNewUnit({...newUnit, name: preset}); setShowCustomType(false); }}
                  className={`p-2 rounded-xl text-[10px] font-bold border transition-all ${newUnit.name === preset ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}
                >
                  {preset}
                </button>
              ))}
              <button type="button" onClick={() => { setNewUnit({...newUnit, name: ''}); setShowCustomType(true); }} className={`p-2 rounded-xl text-[10px] font-bold border transition-all ${showCustomType ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>Other</button>
            </div>
            {showCustomType && <input type="text" placeholder="Type name..." value={newUnit.name} onChange={e => setNewUnit({...newUnit, name: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none" />}
            <div className="relative"><span className="absolute left-3 top-3.5 text-gray-400">₦</span><input type="number" placeholder="Price per year" value={newUnit.price} onChange={e => setNewUnit({...newUnit, price: e.target.value})} className="w-full p-4 pl-7 bg-white border border-gray-200 rounded-2xl focus:border-blue-500 outline-none" /></div>
            <button onClick={handleAddUnit} disabled={!newUnit.name || !newUnit.price} className="w-full py-4 bg-blue-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2"><Plus size={20} /> Add this Room</button>
          </div>

          <div className="flex gap-4"><button onClick={() => setStep(1)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold">Back</button><button onClick={() => setStep(3)} disabled={units.length === 0} className="flex-2 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 disabled:opacity-50">Next: Media</button></div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right duration-300">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold mb-4">Lodge Visuals</h3>
            <p className="text-sm text-gray-500 mb-6">Upload general photos of the building like the Gate, Compound, or Hallway.</p>
            <div className="grid grid-cols-3 gap-2">
              {generalImages.map((img, i) => <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100"><img src={img} className="w-full h-full object-cover" alt="" /><button onClick={() => setGeneralImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5"><X size={10} /></button></div>)}
              <div onClick={() => fileInputRef.current?.click()} className="aspect-square border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-50">
                {uploading ? <Loader2 className="animate-spin" size={24} /> : <Camera size={24} />}
                <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleGeneralImageUpload} />
              </div>
            </div>
          </div>
          <div className="flex gap-4 pt-4"><button onClick={() => setStep(2)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold">Back</button><button onClick={handleSubmit} disabled={uploading} className="flex-2 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 disabled:opacity-50">{uploading ? 'Finalizing...' : 'Publish Listing'}</button></div>
        </div>
      )}
    </div>
  );
}