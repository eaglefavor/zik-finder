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

if (!CLOUDINARY_UPLOAD_PRESET || !CLOUDINARY_CLOUD_NAME) {
  throw new Error('Missing Cloudinary environment variables');
}

export default function PostLodge() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null); // For general images
  const unitFileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({}); // For unit images

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

  // Step 2 & 3: Room Types & Media
  // We use a temp ID to track units before they are saved to DB
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  const compressImage = (file: File): Promise<File> => {
    console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    return new Promise((resolve, reject) => {
      new Compressor(file, {
        quality: 0.6,
        maxWidth: 1200,
        success(result) {
          const compressed = result as File;
          console.log(`Compressed size: ${(compressed.size / 1024 / 1024).toFixed(2)} MB`);
          console.log(`Reduction: ${Math.round((1 - compressed.size / file.size) * 100)}%`);
          resolve(compressed);
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

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: data,
      }
    );

    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.secure_url;
  };

  const handleGeneralImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const compressed = await compressImage(file);
        return uploadToCloudinary(compressed);
      });
      const urls = await Promise.all(uploadPromises);
      setGeneralImages(prev => [...prev, ...urls]);
    } catch (err) {
      alert('Error uploading images');
      console.error(err);
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
      const uploadPromises = Array.from(files).map(async (file) => {
        const compressed = await compressImage(file);
        return uploadToCloudinary(compressed);
      });
      const urls = await Promise.all(uploadPromises);
      
      setUnits(prev => prev.map(u => 
        u.tempId === tempId ? { ...u, image_urls: [...u.image_urls, ...urls] } : u
      ));
    } catch (err) {
      alert('Error uploading unit images');
      console.error(err);
    } finally {
      setUploading(false);
      if (unitFileInputRefs.current[tempId]) {
        unitFileInputRefs.current[tempId]!.value = '';
      }
    }
  };

  const handleAddUnit = () => {
    if (!newUnit.name || !newUnit.price) return;
    setUnits([...units, {
      tempId: Date.now().toString(),
      name: newUnit.name,
      price: parseInt(newUnit.price),
      total_units: parseInt(newUnit.total_units),
      image_urls: []
    }]);
    setNewUnit({ name: '', price: '', total_units: '1' });
  };

  const handleDeleteUnit = (tempId: string) => {
    setUnits(units.filter(u => u.tempId !== tempId));
  };

  const toggleAmenity = (item: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(item)
        ? prev.amenities.filter(i => i !== item)
        : [...prev.amenities, item]
    }));
  };

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const handleSubmit = async () => {
    if (!user) return;
    
    // Prepare units for DB (remove tempId, add available_units)
    const finalUnits = units.map(u => ({
      name: u.name,
      price: u.price,
      total_units: u.total_units,
      available_units: u.total_units,
      image_urls: u.image_urls
    }));

    // Find min price for the lodge record
    const minPrice = units.length > 0 
      ? Math.min(...units.map(u => u.price)) 
      : 0;

    const { success, error } = await addLodge({
      title: formData.title,
      price: minPrice,
      location: formData.location,
      description: formData.description || 'No description provided.',
      image_urls: generalImages.length > 0 
        ? generalImages 
        : ['https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg'], // Placeholder
      amenities: formData.amenities,
      status: 'available',
    }, finalUnits);

    if (success) {
      router.push('/');
    } else {
      alert('Error saving lodge: ' + error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!user?.is_verified && role !== 'admin') {
    return (
      <div className="px-4 py-6 flex flex-col items-center justify-center h-[80vh] text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 text-red-500">
          <ShieldAlert size={40} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Verification Required</h1>
        <p className="text-gray-600 mb-8 max-w-xs mx-auto">
          To ensure student safety, only verified landlords can post listings. Please upload your ID to get verified.
        </p>
        <div className="space-y-3 w-full max-w-xs">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all"
          >
            {refreshing ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
            Check Verification Status
          </button>
          <Link href="/profile" className="block w-full py-4 bg-blue-50 text-blue-600 rounded-2xl font-bold">
            Go to Profile
          </Link>
          <Link href="/" className="block w-full py-4 bg-white text-gray-500 font-bold">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 pb-32">
      <header className="flex items-center gap-4 mb-8">
        <Link href="/" className="p-2 bg-white rounded-full shadow-sm border border-gray-100">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Post a Lodge</h1>
          <p className="text-xs text-gray-500 font-medium">Step {step} of 3</p>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((i) => (
          <div 
            key={i} 
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Lodge Name</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                placeholder="e.g. Divine Grace Lodge"
                className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Location</label>
              <select 
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
                className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
              >
                <option value="Ifite">Ifite (School Gate)</option>
                <option value="Amansea">Amansea</option>
                <option value="Temp Site">Temp Site</option>
                <option value="Okpuno">Okpuno</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Description & Landmarks</label>
              <textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Describe the lodge... (e.g. Near the market, quiet environment)"
                className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">General Amenities</label>
              <div className="grid grid-cols-2 gap-3">
                {['Water', 'Light', 'Security', 'Prepaid', 'Parking', 'Tiled'].map((item) => (
                  <div 
                    key={item} 
                    onClick={() => toggleAmenity(item)}
                    className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors ${
                      formData.amenities.includes(item) 
                        ? 'bg-blue-50 border-blue-500' 
                        : 'bg-white border-gray-100'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                      formData.amenities.includes(item) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    }`}>
                      {formData.amenities.includes(item) && <CheckCircle2 size={14} className="text-white" />}
                    </div>
                    <span className="text-sm text-gray-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button 
            onClick={handleNext}
            disabled={!formData.title || !formData.description}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 mt-4 disabled:opacity-50"
          >
            Next: Room Types
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <p className="text-sm text-blue-700 font-medium">
              Add the different types of rooms available in this lodge (e.g. Self-con, Single Room).
            </p>
          </div>

          <div className="space-y-3">
            {units.map((unit) => (
              <div key={unit.tempId} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-900">{unit.name}</h3>
                  <div className="text-sm text-gray-500">
                    ₦{unit.price.toLocaleString()} • {unit.total_units} units
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteUnit(unit.tempId)}
                  className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 rounded-full"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl space-y-3 border border-gray-100">
            <h3 className="text-sm font-bold text-gray-700">Add Room Category</h3>
            <div className="grid grid-cols-2 gap-3">
              <input 
                type="text" 
                placeholder="Type (e.g. Self-con)"
                value={newUnit.name}
                onChange={e => setNewUnit({...newUnit, name: e.target.value})}
                className="col-span-2 p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
              />
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400">₦</span>
                <input 
                  type="number" 
                  placeholder="Price"
                  value={newUnit.price}
                  onChange={e => setNewUnit({...newUnit, price: e.target.value})}
                  className="w-full p-3 pl-7 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
                />
              </div>
              <input 
                type="number" 
                placeholder="Qty"
                value={newUnit.total_units}
                onChange={e => setNewUnit({...newUnit, total_units: e.target.value})}
                className="p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
              />
            </div>
            <button 
              onClick={handleAddUnit}
              disabled={!newUnit.name || !newUnit.price}
              className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
            >
              <Plus size={16} /> Add Category
            </button>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={handleBack}
              className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold"
            >
              Back
            </button>
            <button 
              onClick={handleNext}
              disabled={units.length === 0}
              className="flex-2 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 disabled:opacity-50"
            >
              Next: Upload Media
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right duration-300">
          
          {/* General Lodge Photos */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-gray-900">General Lodge Photos</h3>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg">Gate, Compound, etc.</span>
            </div>
            
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleGeneralImageUpload}
            />
            
            <div className="grid grid-cols-3 gap-2">
              {generalImages.map((img, idx) => (
                <div key={idx} className="relative h-24 rounded-xl overflow-hidden bg-gray-100">
                  <img src={img} className="w-full h-full object-cover" alt="" />
                  <button 
                    onClick={() => setGeneralImages(p => p.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 gap-1 active:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="animate-spin" size={24} /> : <Camera size={24} />}
                <span className="text-[10px] font-medium">Add Photo</span>
              </button>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Unit Specific Photos */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900">Room Category Photos</h3>
            
            {units.map((unit) => (
              <div key={unit.tempId} className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h4 className="font-bold text-gray-800">{unit.name}</h4>
                    <p className="text-xs text-gray-500">Upload photos specific to this room type</p>
                  </div>
                  <span className="text-xs font-bold bg-white border border-gray-200 px-2 py-1 rounded-lg">
                    {unit.image_urls.length} photos
                  </span>
                </div>

                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  ref={(el) => { unitFileInputRefs.current[unit.tempId] = el; }}
                  onChange={(e) => handleUnitImageUpload(e, unit.tempId)}
                />

                <div className="grid grid-cols-3 gap-2">
                  {unit.image_urls.map((img, idx) => (
                    <div key={idx} className="relative h-20 rounded-xl overflow-hidden bg-white border border-gray-200">
                      <img src={img} className="w-full h-full object-cover" alt="" />
                      <button 
                        onClick={() => setUnits(prev => prev.map(u => 
                          u.tempId === unit.tempId 
                            ? { ...u, image_urls: u.image_urls.filter((_, i) => i !== idx) } 
                            : u
                        ))}
                        className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => unitFileInputRefs.current[unit.tempId]?.click()}
                    disabled={uploading}
                    className="h-20 border-2 border-dashed border-gray-300 bg-white rounded-xl flex flex-col items-center justify-center text-gray-400 gap-1 active:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="animate-spin" size={20} /> : <ImageIcon size={20} />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              onClick={handleBack}
              className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold"
            >
              Back
            </button>
            <button 
              onClick={handleSubmit}
              disabled={uploading}
              className="flex-2 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Publish Lodge'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}