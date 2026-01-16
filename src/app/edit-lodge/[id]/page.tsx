'use client';

import { Camera, MapPin, CheckCircle2, ChevronLeft, X, Loader2, Save, Plus, Trash2, LayoutGrid, Info, Image as ImageIcon, Check, Sparkles, Building2, ChevronRight } from 'lucide-react';
import { useData } from '@/lib/data-context';
import { useAppContext } from '@/lib/context';
import Compressor from 'compressorjs';
import { ROOM_TYPE_PRESETS, AREA_LANDMARKS } from '@/lib/constants';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import { useRef, useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'zik_lodges';
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dhpvia1ae';

export default function EditLodge() {
  const router = useRouter();
  const { id } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { lodges, myLodges, updateLodge, addUnit, updateUnit, deleteUnit } = useData();
  const { user, role, isLoading } = useAppContext();
  
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingLodge, setLoadingLodge] = useState(true);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    location: 'Ifite',
    landmark: 'School Gate',
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

  // Use myLodges to find the lodge, fallback to global lodges
  const lodge = useMemo(() => {
    const combined = [...(myLodges || []), ...lodges];
    return combined.find(l => l.id === id);
  }, [myLodges, lodges, id]);
  const currentUnits = lodge?.units || [];

  useEffect(() => {
    if (id && lodges.length > 0) {
      if (lodge) {
        // Verify ownership
        if (user && lodge.landlord_id !== user.id && role !== 'admin') {
          toast.error('Access Denied', {
            description: 'You do not have permission to edit this lodge.'
          });
          router.push('/');
          return;
        }

        setFormData({
          title: lodge.title,
          location: lodge.location,
          landmark: lodge.landmark || 'School Gate',
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
      toast.success('Images uploaded');
    } catch (err) {
      toast.error('Upload failed');
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
    toast.success('Room type added');
    setNewUnit({ name: '', price: '', total_units: '1' });
    setShowCustomType(false);
  };

  const handleUpdateUnitPrice = async (unitId: string) => {
    const priceNum = parseInt(editPrice);
    if (isNaN(priceNum) || !id) return;
    
    await updateUnit(unitId, { price: priceNum });
    
    const otherUnits = currentUnits.filter(u => u.id !== unitId);
    const allPrices = [...otherUnits.map(u => u.price), priceNum];
    const newMinPrice = Math.min(...allPrices);

    await updateLodge(id as string, { price: newMinPrice });
    
    toast.success('Price updated');
    setEditingUnitId(null);
  };

  const handleDeleteUnitClick = (unitId: string) => {
    toast.error('Delete this room type?', {
      description: 'This will remove this vacancy from your lodge.',
      action: {
        label: 'Delete',
        onClick: async () => {
          await deleteUnit(unitId);
          toast.success('Room type removed');
        }
      }
    });
  };

  const handleSubmit = async () => {
    if (!user || typeof id !== 'string') return;
    setSaving(true);
    
    const minPrice = currentUnits.length > 0 
      ? Math.min(...currentUnits.map(u => u.price)) 
      : (lodge?.price || 0);

    const { success, error } = await updateLodge(id, {
      ...formData,
      price: minPrice
    });

    setSaving(false);
    if (success) {
      toast.success('Lodge updated successfully!');
      router.push('/');
    } else {
      toast.error('Update failed: ' + error);
    }
  };

  if (isLoading || loadingLodge) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-gray-500 font-bold text-sm animate-pulse uppercase tracking-widest">Loading Lodge Data</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Premium Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 py-5 shadow-sm shadow-gray-100/50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.back()} 
              className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all active:scale-90"
            >
              <ChevronLeft size={22} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none">Edit Lodge</h1>
              <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-1">Management Mode</p>
            </div>
          </div>
          <button 
            onClick={handleSubmit}
            disabled={saving || !formData.title}
            className="hidden sm:flex bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Save Changes</>}
          </button>
        </div>
      </header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto px-4 py-8 space-y-8"
      >
        {/* Basic Info Section */}
        <section className="bg-white p-6 xs:p-8 rounded-[32px] xs:rounded-[40px] border border-gray-100 shadow-sm space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="font-black text-gray-900 text-lg tracking-tight">Basic Information</h2>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Main Details</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Lodge Title</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                placeholder="e.g. Silver Crest Lodge"
                className="w-full p-4 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-gray-900"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Area / Location</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <select 
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value, landmark: AREA_LANDMARKS[e.target.value][0]})}
                    className="w-full p-4 pl-12 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none appearance-none font-bold text-gray-900"
                  >
                    {Object.keys(AREA_LANDMARKS).map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <select 
                    value={formData.landmark}
                    onChange={e => setFormData({...formData, landmark: e.target.value})}
                    className="w-full p-4 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none appearance-none font-bold text-gray-900"
                  >
                    {AREA_LANDMARKS[formData.location].map(lm => (
                      <option key={lm} value={lm}>{lm}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Description</label>
              <textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                rows={4}
                placeholder="Describe your lodge to students..."
                className="w-full p-4 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-medium text-gray-700"
              />
            </div>
          </div>
        </section>

        {/* Photos Section */}
        <section className="bg-white p-6 xs:p-8 rounded-[32px] xs:rounded-[40px] border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                <ImageIcon size={20} />
              </div>
              <div>
                <h2 className="font-black text-gray-900 text-lg tracking-tight">Gallery</h2>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{formData.image_urls.length}/10 Photos</p>
              </div>
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors active:scale-90"
            >
              <Plus size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <AnimatePresence>
              {formData.image_urls.map((img, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 group border border-gray-100 shadow-inner"
                >
                  <Image src={img} fill className="object-cover group-hover:scale-110 transition-transform duration-500" alt="Lodge" />
                  <button 
                    onClick={() => setFormData(p => ({...p, image_urls: p.image_urls.filter((_, i) => i !== idx)}))}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 backdrop-blur-md"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {formData.image_urls.length < 10 && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400 gap-2 hover:bg-gray-50 hover:border-blue-300 transition-all active:scale-95"
              >
                {uploading ? <Loader2 className="animate-spin" size={24} /> : <><Camera size={24} /><span className="text-[8px] font-black uppercase tracking-widest">Add Photo</span></>}
              </button>
            )}
          </div>
          <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
        </section>

        {/* Amenities Section */}
        <section className="bg-white p-6 xs:p-8 rounded-[32px] xs:rounded-[40px] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="font-black text-gray-900 text-lg tracking-tight">Amenities</h2>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Features & Perks</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {['Water', 'Light', 'Security', 'Prepaid', 'Parking', 'Tiled'].map((item) => {
              const isSelected = formData.amenities.includes(item);
              return (
                <button 
                  key={item} 
                  onClick={() => setFormData(p => ({
                    ...p, 
                    amenities: isSelected ? p.amenities.filter(i => i !== item) : [...p.amenities, item]
                  }))}
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                    isSelected ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-md shadow-blue-100' : 'bg-white border-gray-50 text-gray-500'
                  }`}
                >
                  <span className="text-xs font-black uppercase tracking-widest">{item}</span>
                  <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-200'
                  }`}>
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Inventory Section */}
        <section className="bg-white p-6 xs:p-8 rounded-[32px] xs:rounded-[40px] border border-gray-100 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                <LayoutGrid size={20} />
              </div>
              <div>
                <h2 className="font-black text-gray-900 text-lg tracking-tight">Room Inventory</h2>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Types & Vacancy</p>
              </div>
            </div>
            <div className="px-2 py-1 bg-orange-50 text-orange-600 text-[8px] font-black uppercase tracking-widest rounded-lg animate-pulse">Live Updates</div>
          </div>

          <div className="space-y-3">
            <AnimatePresence mode='popLayout'>
              {currentUnits.map((unit) => (
                <motion.div 
                  layout
                  key={unit.id} 
                  className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center border border-gray-100 shadow-sm"
                >
                  <div className="flex-1 mr-4 min-w-0">
                    <h3 className="font-black text-gray-900 text-[10px] uppercase tracking-widest">{unit.name}</h3>
                    {editingUnitId === unit.id ? (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="relative flex-1 max-w-[140px]">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-black">₦</span>
                          <input 
                            type="number"
                            autoFocus
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-full p-2.5 pl-7 bg-white border-2 border-blue-500 rounded-xl text-xs font-black outline-none"
                          />
                        </div>
                        <button onClick={() => handleUpdateUnitPrice(unit.id)} className="p-2.5 bg-blue-600 text-white rounded-xl active:scale-90 transition-transform"><Check size={16} /></button>
                        <button onClick={() => setEditingUnitId(null)} className="p-2.5 bg-gray-200 text-gray-600 rounded-xl active:scale-90 transition-transform"><X size={16} /></button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          setEditingUnitId(unit.id);
                          setEditPrice(unit.price.toString());
                        }}
                        className="text-xs text-blue-600 font-black hover:underline mt-1.5 flex items-center gap-1.5"
                      >
                        ₦{unit.price.toLocaleString()} <span className="w-1 h-1 bg-gray-300 rounded-full" /> {unit.available_units}/{unit.total_units} Left
                      </button>
                    )}
                  </div>
                  <button onClick={() => handleDeleteUnitClick(unit.id)} className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                    <Trash2 size={18} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Add Unit Form */}
          <div className="pt-8 border-t border-gray-50 space-y-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Add a New Room Category</p>
            <div className="grid grid-cols-1 gap-4">
              <div className="relative">
                <select 
                  className="w-full p-4 bg-gray-50 border border-transparent rounded-2xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all"
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
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 rotate-90" size={18} />
              </div>

              {showCustomType && (
                <input 
                  type="text" placeholder="Custom Category Name" value={newUnit.name} 
                  onChange={e => setNewUnit({...newUnit, name: e.target.value})} 
                  className="w-full p-4 bg-gray-50 border border-blue-200 rounded-2xl text-sm font-bold text-gray-900 outline-none animate-in slide-in-from-top-2 duration-300"
                />
              )}

              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-black">₦</span>
                  <input 
                    type="number" placeholder="Price" value={newUnit.price} 
                    onChange={e => setNewUnit({...newUnit, price: e.target.value})} 
                    className="w-full p-4 pl-8 bg-gray-50 border border-transparent rounded-2xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="w-24 relative">
                  <input 
                    type="number" placeholder="Qty" value={newUnit.total_units}
                    onChange={e => setNewUnit({...newUnit, total_units: e.target.value})}
                    className="w-full p-4 bg-gray-50 border border-transparent rounded-2xl text-sm font-bold text-gray-900 outline-none focus:bg-white focus:border-blue-500 text-center transition-all"
                  />
                </div>
              </div>
              
              <button 
                onClick={handleAddUnit}
                disabled={!newUnit.name || !newUnit.price}
                className="w-full py-4.5 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-gray-200"
              >
                <Plus size={18} /> Add Category
              </button>
            </div>
          </div>
        </section>

        {/* Final Save Action (Visible on all screens) */}
        <div className="pt-4">
          <button 
            onClick={handleSubmit}
            disabled={saving || !formData.title}
            className="w-full py-5 bg-blue-600 text-white rounded-[32px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-blue-200 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} /> Save All Changes</>}
          </button>
          <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-4">
            Changes will be reflected immediately across the platform.
          </p>
        </div>
      </motion.div>

      {/* Floating Save FAB for Mobile */}
      <div className="fixed bottom-6 left-4 right-4 z-40 sm:hidden">
        <button 
          onClick={handleSubmit}
          disabled={saving || !formData.title}
          className="w-full bg-blue-600 text-white py-4.5 rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-300 flex items-center justify-center gap-3 active:scale-95 transition-all"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Save All Updates</>}
        </button>
      </div>
    </div>
  );
}