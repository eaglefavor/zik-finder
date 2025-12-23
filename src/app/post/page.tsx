'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, MapPin, CheckCircle2, ChevronLeft, X, Loader2, ShieldAlert, RefreshCw, Plus, Trash2 } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLodge } = useData();
  const { user, role, isLoading, refreshProfile } = useAppContext();
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    location: 'Ifite',
    price: '',
    description: '',
    amenities: [] as string[],
    image_urls: [] as string[]
  });

  const [units, setUnits] = useState<{ name: string; price: number; total_units: number; available_units: number; image_urls: string[] }[]>([]);
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

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const toggleAmenity = (item: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(item)
        ? prev.amenities.filter(i => i !== item)
        : [...prev.amenities, item]
    }));
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        try {
          const compressedFile = await compressImage(file);
          return uploadToCloudinary(compressedFile);
        } catch (err) {
          console.error('Compression failed for one image, uploading original:', err);
          return uploadToCloudinary(file);
        }
      });
      
      const urls = await Promise.all(uploadPromises);
      
      setFormData(prev => ({
        ...prev,
        image_urls: [...prev.image_urls, ...urls].slice(0, 6)
      }));
    } catch (err) {
      alert('Error uploading images to Cloudinary. Check your Cloud Name and Preset.');
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };


  const handleAddUnit = () => {
    if (!newUnit.name || !newUnit.price) return;
    setUnits([...units, {
      name: newUnit.name,
      price: parseInt(newUnit.price),
      total_units: parseInt(newUnit.total_units),
      available_units: parseInt(newUnit.total_units),
      image_urls: []
    }]);
    setNewUnit({ name: '', price: '', total_units: '1' });
  };

  const handleDeleteUnit = (index: number) => {
    setUnits(units.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    // If no units added, warn or force default
    // We'll proceed, assuming addLodge handles fallback if units array is empty, 
    // but better UX is to encourage adding units.
    
    const { success, error } = await addLodge({
      title: formData.title,
      price: parseInt(formData.price) || 0,
      location: formData.location,
      description: formData.description || 'No description provided.',
      image_urls: formData.image_urls.length > 0 
        ? formData.image_urls 
        : ['https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg'], // Placeholder
      amenities: formData.amenities,
      status: 'available',
    }, units);

    if (success) {
      router.push('/');
    } else {
      alert('Error saving lodge: ' + error);
    }
  };

  return (
    <div className="px-4 py-6">
      <header className="flex items-center gap-4 mb-8">
        <Link href="/" className="p-2 bg-white rounded-full shadow-sm border border-gray-100">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Post a Lodge</h1>
      </header>

      {/* Progress Stepper */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Lodge Title</label>
            <input 
              type="text" 
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="e.g. Clean Self-con in Ifite"
              className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Lodge Photos (Public via Cloudinary)</label>
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <div className="grid grid-cols-3 gap-2">
              {formData.image_urls.map((img, idx) => (
                <div key={idx} className="relative h-24 rounded-xl overflow-hidden bg-gray-100">
                  <img src={img} className="w-full h-full object-cover" alt="" />
                  <button 
                    onClick={() => setFormData(p => ({...p, image_urls: p.image_urls.filter((_, i) => i !== idx)}))}
                    className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {formData.image_urls.length < 6 && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="h-24 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 gap-1 active:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    <>
                      <Camera size={24} />
                      <span className="text-[10px] font-medium">Add Photo</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Location</label>
            <select 
              value={formData.location}
              onChange={e => setFormData({...formData, location: e.target.value})}
              className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
            >
              <option value="Ifite">Ifite</option>
              <option value="Amansea">Amansea</option>
              <option value="Temp Site">Temp Site</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Starting Price (Per Year)</label>
            <div className="relative">
              <span className="absolute left-4 top-4 font-bold text-gray-400">₦</span>
              <input 
                type="number" 
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
                placeholder="0.00"
                className="w-full p-4 pl-10 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <button 
            onClick={handleNext}
            disabled={!formData.title || !formData.price || formData.image_urls.length === 0}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 mt-4 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Description</label>
            <textarea 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Tell students about the lodge..."
              className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Amenities</label>
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
          <div className="flex gap-4">
            <button 
              onClick={handleBack}
              className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold"
            >
              Back
            </button>
            <button 
              onClick={handleNext}
              className="flex-2 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200"
            >
              Add Room Types
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4">
            <p className="text-sm text-blue-700">
              Does this lodge have different types of rooms? Add them below (e.g. Self-con, Single Room).
            </p>
          </div>

          <div className="space-y-4">
            {units.map((unit, idx) => (
              <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-900">{unit.name}</h3>
                  <div className="text-sm text-gray-500">
                    ₦{unit.price.toLocaleString()} • {unit.total_units} units
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteUnit(idx)}
                  className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 rounded-full"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-gray-700">Add Room Type</h3>
            <div className="grid grid-cols-2 gap-3">
              <input 
                type="text" 
                placeholder="e.g. Standard Self-con"
                value={newUnit.name}
                onChange={e => setNewUnit({...newUnit, name: e.target.value})}
                className="col-span-2 p-3 bg-white border border-gray-200 rounded-xl text-sm"
              />
              <input 
                type="number" 
                placeholder="Price"
                value={newUnit.price}
                onChange={e => setNewUnit({...newUnit, price: e.target.value})}
                className="p-3 bg-white border border-gray-200 rounded-xl text-sm"
              />
              <input 
                type="number" 
                placeholder="Qty"
                value={newUnit.total_units}
                onChange={e => setNewUnit({...newUnit, total_units: e.target.value})}
                className="p-3 bg-white border border-gray-200 rounded-xl text-sm"
              />
            </div>
            <button 
              onClick={handleAddUnit}
              disabled={!newUnit.name || !newUnit.price}
              className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus size={16} /> Add Unit
            </button>
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              onClick={handleBack}
              className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold"
            >
              Back
            </button>
            <button 
              onClick={handleNext}
              className="flex-2 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200"
            >
              Review
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to Post?</h2>
          <p className="text-gray-500 mb-8 max-w-xs">
            Your lodge will be visible to thousands of students at UNIZIK.
          </p>
          <div className="w-full space-y-4">
            <button 
              onClick={handleSubmit}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200"
            >
              Publish Listing
            </button>
            <button 
              onClick={handleBack}
              className="w-full py-4 bg-white text-gray-500 font-bold"
            >
              Back to Details
            </button>
          </div>
        </div>
      )}