'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Camera, MapPin, CheckCircle2, ChevronLeft, X, Loader2, Save, Plus, Trash2, LayoutGrid, Info, Image as ImageIcon, Check } from 'lucide-react';
import { useData } from '@/lib/data-context';
import { useAppContext } from '@/lib/context';
import Compressor from 'compressorjs';
import { ROOM_TYPE_PRESETS } from '@/lib/constants';

// Cloudinary Configuration
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;

export default function EditLodge() {
  const router = useRouter();
  const { id } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { lodges, updateLodge, addUnit, updateUnit, deleteUnit } = useData();
  const { user, role, isLoading } = useAppContext();
  
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingLodge, setLoadingLodge] = useState(true);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    location: 'Ifite',
    description: '',
    amenities: [] as string[],
    image_urls: [] as string[]
  });

  const [newUnit, setNewUnit] = useState({
    name: '',
    price: '',
    total_units: '1'
  });
  const [showCustomType, setShowCustomType] = useState(false);

  // Find the current lodge and its units from the data context
  const lodge = useMemo(() => lodges.find(l => l.id === id), [lodges, id]);
  const currentUnits = lodge?.units || [];

  useEffect(() => {
    if (id && lodges.length > 0) {
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
          description: lodge.description,
          amenities: lodge.amenities,
          image_urls: lodge.image_urls
        });
        setLoadingLodge(false);
      } else {
        if (!isLoading) setLoadingLodge(false); 
      }
    }
  }, [id, lodges, user, role, isLoading, router, lodge]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls = await Promise.all(Array.from(files).map(async (file) => {
        const compressed = await compressImage(file);
        return uploadToCloudinary(compressed);
      }));
      setFormData(prev => ({
        ...prev,
        image_urls: [...prev.image_urls, ...urls].slice(0, 10)
      }));
    } catch (err) {
      alert('Error uploading images');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddUnit = async () => {
    if (!newUnit.name || !newUnit.price) return;
    await addUnit({
      lodge_id: id as string,
      name: newUnit.name,
      price: parseInt(newUnit.price),
      total_units: parseInt(newUnit.total_units),
      available_units: parseInt(newUnit.total_units),
      image_urls: []
    });
    setNewUnit({ name: '', price: '', total_units: '1' });
    setShowCustomType(false);
  };

  const handleUpdateUnitPrice = async (unitId: string) => {
    const priceNum = parseInt(editPrice);
    if (isNaN(priceNum) || !id) return;
    
    // 1. Update the unit price
    await updateUnit(unitId, { price: priceNum });
    
    // 2. Recalculate and update the lodge's base price
    // We fetch the latest prices from currentUnits (which are from the context)
    // Note: currentUnits might not have the newest price yet if context hasn't refreshed
    // So we calculate using the new price for the specific unit
    const otherUnits = currentUnits.filter(u => u.id !== unitId);
    const allPrices = [...otherUnits.map(u => u.price), priceNum];
    const newMinPrice = Math.min(...allPrices);

    await updateLodge(id as string, { price: newMinPrice });
    
    setEditingUnitId(null);
  };

  const handleSubmit = async () => {
    if (!user || typeof id !== 'string') return;
    setSaving(true);
    
    // Auto-calculate base price from units
    const minPrice = currentUnits.length > 0 
      ? Math.min(...currentUnits.map(u => u.price)) 
      : (lodge?.price || 0);

    const { success, error } = await updateLodge(id, {
      ...formData,
      price: minPrice
    });

    setSaving(false);
    if (success) {
      alert('Changes saved successfully!');
      router.push('/');
    } else {
      alert('Error: ' + error);
    }
  };

  if (isLoading || loadingLodge) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Fixed Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Edit Lodge</h1>
        </div>
        <button 
          onClick={handleSubmit}
          disabled={saving || !formData.title}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Save</>}
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        
        {/* Basic Info Section */}
        <section className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Info size={20} />
            <h2 className="font-bold text-lg">Basic Information</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Lodge Title</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full p-4 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Area / Location</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-4 text-gray-400" size={18} />
                <select 
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  className="w-full p-4 pl-12 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none appearance-none font-medium"
                >
                  <option value="Ifite">Ifite</option>
                  <option value="Amansea">Amansea</option>
                  <option value="Temp Site">Temp Site</option>
                  <option value="Okpuno">Okpuno</option>
                  <option value="Agu-Awka">Agu-Awka</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Description</label>
              <textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                rows={4}
                className="w-full p-4 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
              />
            </div>
          </div>
        </section>

        {/* Photos Section */}
        <section className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <ImageIcon size={20} />
            <h2 className="font-bold text-lg">Lodge Photos</h2>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {formData.image_urls.map((img, idx) => (
              <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 group">
                <img src={img} className="w-full h-full object-cover" alt="" />
                <button 
                  onClick={() => setFormData(p => ({...p, image_urls: p.image_urls.filter((_, i) => i !== idx)}))}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {formData.image_urls.length < 10 && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400 gap-2 hover:bg-gray-50 transition-colors"
              >
                {uploading ? <Loader2 className="animate-spin" size={24} /> : <><Camera size={24} /><span className="text-[10px] font-bold">ADD PHOTO</span></>}
              </button>
            )}
          </div>
          <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
        </section>

        {/* Amenities Section */}
        <section className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
          <h2 className="font-bold text-lg mb-6">Lodge Amenities</h2>
          <div className="grid grid-cols-2 gap-3">
            {['Water', 'Light', 'Security', 'Prepaid', 'Parking', 'Tiled'].map((item) => {
              const isSelected = formData.amenities.includes(item);
              return (
                <div 
                  key={item} 
                  onClick={() => setFormData(p => ({
                    ...p, 
                    amenities: isSelected ? p.amenities.filter(i => i !== item) : [...p.amenities, item]
                  }))}
                  className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100' : 'bg-white border-gray-100'
                  }`}
                >
                  <span className={`text-sm font-bold ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>{item}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-200'
                  }`}>
                    {isSelected && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Inventory Section */}
        <section className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-blue-600">
              <LayoutGrid size={20} />
              <h2 className="font-bold text-lg">Room Types & Vacancy</h2>
            </div>
            <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-lg uppercase">Live Updates</span>
          </div>

          <div className="space-y-3">
            {currentUnits.map((unit) => (
              <div key={unit.id} className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center border border-gray-100">
                <div className="flex-1 mr-4">
                  <h3 className="font-bold text-gray-900 text-sm">{unit.name}</h3>
                  {editingUnitId === unit.id ? (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="relative flex-1 max-w-[120px]">
                        <span className="absolute left-2 top-1.5 text-gray-400 text-xs font-bold">₦</span>
                        <input 
                          type="number"
                          autoFocus
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-full p-1.5 pl-5 bg-white border border-blue-500 rounded-lg text-xs font-bold outline-none"
                        />
                      </div>
                      <button 
                        onClick={() => handleUpdateUnitPrice(unit.id)}
                        className="p-1.5 bg-blue-600 text-white rounded-lg active:scale-90 transition-transform"
                      >
                        <Check size={14} />
                      </button>
                      <button 
                        onClick={() => setEditingUnitId(null)}
                        className="p-1.5 bg-gray-200 text-gray-600 rounded-lg active:scale-90 transition-transform"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setEditingUnitId(unit.id);
                        setEditPrice(unit.price.toString());
                      }}
                      className="text-xs text-blue-600 font-bold hover:underline mt-1 block"
                    >
                      ₦{unit.price.toLocaleString()} • {unit.available_units}/{unit.total_units} left (Click to edit price)
                    </button>
                  )}
                </div>
                <button onClick={() => confirm('Delete this room type?') && deleteUnit(unit.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors shrink-0">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          {/* Add Unit Form */}
          <div className="pt-4 border-t border-gray-50 space-y-4">
            <p className="text-xs font-bold text-gray-400 uppercase">Add a New Room Type</p>
            <div className="grid grid-cols-1 gap-4">
              <select 
                className="w-full p-4 bg-gray-50 border border-transparent rounded-2xl text-sm outline-none focus:bg-white focus:border-blue-500"
                value={showCustomType ? 'custom' : newUnit.name}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') { setShowCustomType(true); setNewUnit({ ...newUnit, name: '' }); }
                  else { setShowCustomType(false); setNewUnit({ ...newUnit, name: val }); }
                }}
              >
                <option value="" disabled>Select Room Type...</option>
                {ROOM_TYPE_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="custom">Other / Custom</option>
              </select>

              {showCustomType && (
                <input 
                  type="text" placeholder="Custom Description" value={newUnit.name} 
                  onChange={e => setNewUnit({...newUnit, name: e.target.value})} 
                  className="w-full p-4 bg-gray-50 border border-blue-200 rounded-2xl text-sm outline-none"
                />
              )}

              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <span className="absolute left-4 top-4 text-gray-400 text-sm">₦</span>
                  <input 
                    type="number" placeholder="Price" value={newUnit.price} 
                    onChange={e => setNewUnit({...newUnit, price: e.target.value})} 
                    className="w-full p-4 pl-8 bg-gray-50 border border-transparent rounded-2xl text-sm outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
                <div className="w-24">
                  <input 
                    type="number" placeholder="Qty" value={newUnit.total_units}
                    onChange={e => setNewUnit({...newUnit, total_units: e.target.value})}
                    className="w-full p-4 bg-gray-50 border border-transparent rounded-2xl text-sm outline-none focus:bg-white focus:border-blue-500 text-center"
                  />
                </div>
              </div>
              
              <button 
                onClick={handleAddUnit}
                disabled={!newUnit.name || !newUnit.price}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <Plus size={18} /> Add Room Type
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Floating Save FAB for Mobile */}
      <div className="fixed bottom-6 left-4 right-4 z-40 sm:hidden">
        <button 
          onClick={handleSubmit}
          disabled={saving || !formData.title}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-2xl shadow-blue-300 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Save All Changes</>}
        </button>
      </div>
    </div>
  );
}