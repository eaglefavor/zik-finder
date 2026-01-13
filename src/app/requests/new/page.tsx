'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Send, MapPin, BadgeDollarSign, Home, AlertCircle, X, Check, Loader2, Zap } from 'lucide-react';
import { useData } from '@/lib/data-context';
import { useAppContext } from '@/lib/context';
import { toast } from 'sonner';
import { AREA_LANDMARKS } from '@/lib/constants';

const ROOM_TYPES = [
  'Standard Self-con',
  'Executive Self-con',
  'Studio Apartment',
  'Single Room',
  '1-Bedroom Flat',
  '2-Bedroom Flat',
  'Any'
];

export default function NewRequest() {
  const router = useRouter();
  const { addRequest } = useData();
  const { user } = useAppContext();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  
  const [formData, setFormData] = useState({
    locations: [] as string[],
    room_type: 'Standard Self-con',
    minBudget: '',
    maxBudget: '',
    description: '',
    is_urgent: false
  });

  const allAreas = useMemo(() => Object.keys(AREA_LANDMARKS), []);

  const toggleLocation = (area: string) => {
    setFormData(prev => ({
      ...prev,
      locations: prev.locations.includes(area)
        ? prev.locations.filter(a => a !== area)
        : [...prev.locations, area]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (formData.description.length < 10) {
      toast.error("Please provide a more detailed description");
      return;
    }

    if (formData.locations.length === 0) {
      toast.error("Please select at least one area");
      return;
    }

    setLoading(true);

    const min = parseInt(formData.minBudget) || 0;
    const max = parseInt(formData.maxBudget) || 0;

    const { success, error } = await addRequest({
      locations: formData.locations,
      min_budget: min,
      max_budget: max,
      description: `Looking for: ${formData.room_type}. ${formData.description}`,
      location: formData.locations.join(', '), // legacy
      budget_range: `₦${min.toLocaleString()} - ₦${max.toLocaleString()}`, // legacy
      // @ts-expect-error - is_urgent added via migration
      is_urgent: formData.is_urgent
    });

    setLoading(false);
    
    if (success) {
      setSubmitted(true);
      setTimeout(() => router.push('/market'), 2000);
    } else {
      toast.error('Failed to post request: ' + error);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <Send size={40} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Posted!</h1>
        <p className="text-gray-500">
          Landlords in this area have been notified. Check your messages soon.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm border border-gray-100 active:scale-90 transition-transform">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">What are you looking for?</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-blue-50 p-5 rounded-3xl mb-4 border border-blue-100">
          <p className="text-sm text-blue-700 leading-relaxed">
            Can&apos;t find what you need? Post a request and landlords with matching lodges will contact you directly.
          </p>
        </div>

        <div className="space-y-4">
          {/* Multi-Location Picker */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
              <MapPin size={16} className="text-blue-600" /> Where would you like to live?
            </label>
            <div className="flex flex-wrap gap-2">
              {formData.locations.map(loc => (
                <span key={loc} className="px-3 py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-100 flex items-center gap-2">
                  {loc}
                  <button type="button" onClick={() => toggleLocation(loc)}><X size={14} /></button>
                </span>
              ))}
              <button 
                type="button"
                onClick={() => setShowLocationPicker(true)}
                className="px-3 py-2 bg-white border border-dashed border-gray-300 text-gray-500 text-xs font-bold rounded-xl hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                + Add Area
              </button>
            </div>
          </div>

          {/* Room Type */}
          <div className="relative">
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Room Category</label>
            <div className="relative">
              <Home className="absolute left-4 top-4 text-gray-400" size={20} />
              <select 
                value={formData.room_type}
                onChange={e => setFormData({...formData, room_type: e.target.value})}
                className="w-full p-4 pl-12 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-medium text-gray-700"
              >
                {ROOM_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Budget Range */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
              <BadgeDollarSign size={16} className="text-blue-600" /> Budget Range (₦)
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-4 top-4 text-gray-400 text-xs font-bold">MIN</span>
                <input 
                  type="number"
                  value={formData.minBudget}
                  onChange={e => setFormData({...formData, minBudget: e.target.value})}
                  placeholder="e.g. 100,000"
                  className="w-full p-4 pt-8 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                />
              </div>
              <div className="text-gray-300 font-bold">-</div>
              <div className="flex-1 relative">
                <span className="absolute left-4 top-4 text-gray-400 text-xs font-bold">MAX</span>
                <input 
                  type="number"
                  value={formData.maxBudget}
                  onChange={e => setFormData({...formData, maxBudget: e.target.value})}
                  placeholder="e.g. 250,000"
                  className="w-full p-4 pt-8 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                />
              </div>
            </div>
          </div>

          {/* Urgency Toggle */}
          <div 
            onClick={() => setFormData({...formData, is_urgent: !formData.is_urgent})}
            className={`p-5 rounded-3xl border-2 transition-all cursor-pointer flex items-center justify-between ${
              formData.is_urgent ? 'bg-red-50 border-red-200 shadow-lg shadow-red-100' : 'bg-white border-gray-100'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                formData.is_urgent ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                <Zap size={24} className={formData.is_urgent ? 'fill-white' : ''} />
              </div>
              <div>
                <p className={`font-black text-sm uppercase tracking-tight ${formData.is_urgent ? 'text-red-600' : 'text-gray-900'}`}>I am in a hurry</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Need a lodge within 24-48 hours</p>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full relative transition-colors ${formData.is_urgent ? 'bg-red-500' : 'bg-gray-200'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${formData.is_urgent ? 'right-1' : 'left-1'}`} />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">Additional Details <span className="text-red-500">*</span></label>
            <textarea 
              rows={4}
              required
              minLength={10}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="e.g. I prefer an upstairs room with steady light. The compound must be tiled and fenced."
              className="w-full p-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {formData.description.length > 0 && formData.description.length < 10 && (
               <div className="flex items-center gap-1 text-xs text-orange-500 font-medium ml-1">
                 <AlertCircle size={12} /> Minimum 10 characters required
               </div>
            )}
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading || formData.description.length < 10 || formData.locations.length === 0}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
        >
          {loading ? (
            <><Loader2 className="animate-spin" size={20} /> Posting...</>
          ) : (
            <>
              <Send size={20} /> Post Request
            </>
          )}
        </button>
      </form>

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-[32px] rounded-t-[32px] max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center p-6 border-b border-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Select Areas</h2>
              <button onClick={() => setShowLocationPicker(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {allAreas.map(area => {
                const isSelected = formData.locations.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleLocation(area)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      isSelected ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-50' : 'bg-white border-gray-100'
                    }`}
                  >
                    <span className={`font-bold ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>{area}</span>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-200'
                    }`}>
                      {isSelected && <Check size={14} className="text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="p-6">
              <button 
                type="button"
                onClick={() => setShowLocationPicker(false)}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
