'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Send, MapPin, BadgeDollarSign, Home, AlertCircle, X, Check, Loader2, Zap, ChevronRight, Plus } from 'lucide-react';
import { useData } from '@/lib/data-context';
import { useAppContext } from '@/lib/context';
import { toast } from 'sonner';
import { AREA_LANDMARKS } from '@/lib/constants';
import { DETAILED_ROOM_TYPES } from '@/lib/room-types';

export default function NewRequest() {
  const router = useRouter();
  const { addRequest } = useData();
  const { user } = useAppContext();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showRoomTypeModal, setShowRoomTypeModal] = useState(false);
  
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

          {/* Dynamic Landmarks Section */}
          {(() => {
            const selectedAreas = formData.locations.filter(l => Object.keys(AREA_LANDMARKS).includes(l));
            const availableLandmarks = selectedAreas.flatMap(area => AREA_LANDMARKS[area] || []);
            
            if (availableLandmarks.length === 0) return null;

            return (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
                  <MapPin size={16} className="text-orange-500" /> Specific Landmarks (Optional)
                </label>
                <div className="flex flex-wrap gap-2 bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                  {availableLandmarks.map(lm => {
                    const isSelected = formData.locations.includes(lm);
                    return (
                      <button
                        key={lm}
                        type="button"
                        onClick={() => toggleLocation(lm)}
                        className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
                          isSelected 
                            ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-sm' 
                            : 'bg-white text-gray-500 border-gray-200 hover:border-orange-200 hover:text-orange-600'
                        }`}
                      >
                        {lm}
                        {isSelected && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Room Type */}
          <div className="relative">
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Room Category</label>
            <button 
              type="button"
              onClick={() => setShowRoomTypeModal(true)}
              className="w-full p-4 bg-white border border-gray-100 rounded-2xl shadow-sm flex justify-between items-center active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-3">
                <Home className="text-gray-400" size={20} />
                <span className={formData.room_type ? 'text-gray-900 font-bold' : 'text-gray-400'}>
                  {formData.room_type || 'Select Room Type...'}
                </span>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </button>
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
              <h2 className="text-xl font-bold text-gray-900">Select Areas & Landmarks</h2>
              <button onClick={() => setShowLocationPicker(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {allAreas.map(area => {
                const isAreaSelected = formData.locations.includes(area);
                return (
                  <div key={area} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleLocation(area)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        isAreaSelected ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-50' : 'bg-white border-gray-100'
                      }`}
                    >
                      <span className={`font-bold ${isAreaSelected ? 'text-blue-700' : 'text-gray-600'}`}>{area}</span>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isAreaSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-200'
                      }`}>
                        {isAreaSelected && <Check size={14} className="text-white" />}
                      </div>
                    </button>

                    {/* Landmarks for this area */}
                    {isAreaSelected && AREA_LANDMARKS[area] && (
                      <div className="pl-4 grid grid-cols-1 gap-2 border-l-2 border-gray-100 ml-2">
                        {AREA_LANDMARKS[area].map(landmark => {
                          const isLandmarkSelected = formData.locations.includes(landmark);
                          return (
                            <button
                              key={landmark}
                              type="button"
                              onClick={() => toggleLocation(landmark)}
                              className={`text-left text-xs font-bold py-2 px-3 rounded-xl transition-all flex items-center gap-2 ${
                                isLandmarkSelected 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                isLandmarkSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                              }`}>
                                {isLandmarkSelected && <Check size={10} className="text-white" />}
                              </div>
                              {landmark}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="p-6 border-t border-gray-50">
              <button 
                type="button"
                onClick={() => setShowLocationPicker(false)}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200"
              >
                Done ({formData.locations.length} Selected)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room Type Selection Modal */}
      {showRoomTypeModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-[32px] rounded-t-[32px] max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-50">
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">Select Room Type</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Choose category & see typical prices</p>
              </div>
              <button onClick={() => setShowRoomTypeModal(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {DETAILED_ROOM_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, room_type: type.name });
                    setShowRoomTypeModal(false);
                  }}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] group ${
                    formData.room_type === type.name 
                      ? 'bg-blue-50 border-blue-600 ring-1 ring-blue-50' 
                      : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-blue-50/30'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`font-black text-sm ${formData.room_type === type.name ? 'text-blue-700' : 'text-gray-900'}`}>
                      {type.name}
                    </span>
                    <span className="px-2 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded-lg border border-green-100 uppercase tracking-tight">
                      {type.priceRange}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed">
                    {type.description}
                  </p>
                </button>
              ))}
              
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, room_type: 'Any' });
                  setShowRoomTypeModal(false);
                }}
                className="w-full p-4 rounded-2xl border-2 border-dashed border-gray-300 text-left hover:bg-gray-50 transition-all text-gray-500 font-bold text-sm flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Any / No Preference
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
