'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Camera, MapPin, CheckCircle2, ChevronLeft, X, Loader2, ShieldAlert, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useData } from '@/lib/data-context';
import { useAppContext } from '@/lib/context';
import Compressor from 'compressorjs';
import { LodgeUnit } from '@/lib/types';

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

export default function EditLodge() {
  const router = useRouter();
  const { id } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { lodges, updateLodge, addUnit, deleteUnit } = useData();
  const { user, role, isLoading } = useAppContext();
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [loadingLodge, setLoadingLodge] = useState(true);
  
  const [formData, setFormData] = useState({
    title: '',
    location: 'Ifite',
    price: '',
    description: '',
    amenities: [] as string[],
    image_urls: [] as string[]
  });

  const [currentUnits, setCurrentUnits] = useState<LodgeUnit[]>([]);
  const [newUnit, setNewUnit] = useState({
    name: '',
    price: '',
    total_units: '1'
  });

  useEffect(() => {
    if (id && lodges.length > 0) {
      const lodge = lodges.find(l => l.id === id);
      if (lodge) {
        // Verify ownership
        if (user && lodge.landlord_id !== user.id && role !== 'admin') {
          alert('You do not have permission to edit this lodge.');
          router.push('/');
          return;
        }

        setFormData({
          title: lodge.title,
          location: lodge.location,
          price: lodge.price.toString(),
          description: lodge.description,
          amenities: lodge.amenities,
          image_urls: lodge.image_urls
        });
        setCurrentUnits(lodge.units || []);
        setLoadingLodge(false);
      } else {
        if (!isLoading) setLoadingLodge(false); 
      }
    }
  }, [id, lodges, user, role, isLoading, router]);

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
          console.error('Compression failed:', err);
          return uploadToCloudinary(file);
        }
      });
      
      const urls = await Promise.all(uploadPromises);
      
      setFormData(prev => ({
        ...prev,
        image_urls: [...prev.image_urls, ...urls].slice(0, 6)
      }));
    } catch (err) {
      alert('Error uploading images');
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddUnit = async () => {
    if (!newUnit.name || !newUnit.price) return;
    if (typeof id !== 'string') return;

    await addUnit({
      lodge_id: id,
      name: newUnit.name,
      price: parseInt(newUnit.price),
      total_units: parseInt(newUnit.total_units),
      available_units: parseInt(newUnit.total_units),
      image_urls: []
    });

    setNewUnit({ name: '', price: '', total_units: '1' });
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (confirm('Delete this room type?')) {
      await deleteUnit(unitId);
    }
  };

  const handleSubmit = async () => {
    if (!user || typeof id !== 'string') return;
    
    const { success, error } = await updateLodge(id, {
      title: formData.title,
      price: parseInt(formData.price) || 0,
      location: formData.location,
      description: formData.description || '',
      image_urls: formData.image_urls,
      amenities: formData.amenities,
    });

    if (success) {
      alert('Lodge updated successfully!');
      router.push('/');
    } else {
      alert('Error updating lodge: ' + error);
    }
  };

  if (isLoading || loadingLodge) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <header className="flex items-center gap-4 mb-8">
        <Link href="/" className="p-2 bg-white rounded-full shadow-sm border border-gray-100">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Lodge</h1>
      </header>

      {/* Progress Bar with Labels */}
      <div className="mb-10">
        <div className="flex justify-between mb-2">
          {['Info', 'Amenities', 'Rooms', 'Save'].map((label, i) => (
            <span 
              key={label} 
              className={`text-[10px] font-black uppercase tracking-widest ${
                i + 1 <= step ? 'text-blue-600' : 'text-gray-300'
              }`}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i} 
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                i <= step ? 'bg-blue-600 shadow-sm shadow-blue-100' : 'bg-gray-100'
              }`}
            />
          ))}
        </div>
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
            <label className="text-sm font-bold text-gray-700">Lodge Photos</label>
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
                      <span className="text-[10px] font-medium">Add</span>
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
            <label className="text-sm font-bold text-gray-700">Price (Min/Base)</label>
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
              Manage Units
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Room Types & Availability</h2>
          <p className="text-sm text-gray-500">Manage different types of rooms available in this lodge.</p>

          <div className="space-y-4">
            {currentUnits.map((unit) => (
              <div key={unit.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-900">{unit.name}</h3>
                  <div className="text-sm text-gray-500">
                    ₦{unit.price.toLocaleString()} • {unit.available_units} / {unit.total_units} left
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteUnit(unit.id)}
                  className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 rounded-full"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-gray-700">Add New Room Type</h3>
            
            {/* Presets Grid */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {ROOM_TYPE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => { setNewUnit({ ...newUnit, name: preset }); setShowCustomType(false); }}
                  className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                    newUnit.name === preset 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
              <button
                onClick={() => { setNewUnit({ ...newUnit, name: '' }); setShowCustomType(true); }}
                className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                  showCustomType 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                Other / Custom
              </button>
            </div>

            {/* Custom Name Input */}
            {showCustomType && (
              <input 
                type="text" 
                placeholder="e.g. Shop-as-Room"
                value={newUnit.name}
                onChange={e => setNewUnit({...newUnit, name: e.target.value})}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 mb-2"
                autoFocus
              />
            )}

            <div className="grid grid-cols-2 gap-3">
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Changes</h2>
          <p className="text-gray-500 mb-8 max-w-xs">
            Review your changes before saving.
          </p>
          <div className="w-full space-y-4">
            <button 
              onClick={handleSubmit}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200"
            >
              Save Changes
            </button>
            <button 
              onClick={handleBack}
              className="w-full py-4 bg-white text-gray-500 font-bold"
            >
              Back to Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}