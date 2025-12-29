'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Send, MapPin, BadgeDollarSign, Home, AlertCircle } from 'lucide-react';
import { useData } from '@/lib/data-context';
import { useAppContext } from '@/lib/context';

const ROOM_TYPES = [
  'Self-con',
  'One Room',
  'Flat (1 Bedroom)',
  'Flat (2 Bedroom)',
  'Flat (3 Bedroom)',
  'Any'
];

export default function NewRequest() {
  const router = useRouter();
  const { addRequest } = useData();
  const { user } = useAppContext();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    location: 'Ifite (School Gate Area)',
    room_type: 'Self-con',
    budget: '',
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (formData.description.length < 10) {
      alert("Please provide a more detailed description (at least 10 characters).");
      return;
    }

    setLoading(true);

    // Combine room type into description or budget string for now as the schema might not have room_type column yet
    // Or just append it to description to be safe without schema changes
    const fullDescription = `Looking for: ${formData.room_type}. ${formData.description}`;

    await addRequest({
      location: formData.location,
      budget_range: formData.budget ? `₦${formData.budget}` : 'Flexible',
      description: fullDescription,
    });

    setLoading(false);
    setSubmitted(true);
    setTimeout(() => router.push('/market'), 2000);
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
          {/* Location */}
          <div className="relative">
            <MapPin className="absolute left-4 top-4 text-gray-400" size={20} />
            <select 
              value={formData.location}
              onChange={e => setFormData({...formData, location: e.target.value})}
              className="w-full p-4 pl-12 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-medium text-gray-700"
            >
              <option>Ifite (School Gate Area)</option>
              <option>Amansea</option>
              <option>Temp Site</option>
              <option>Okpuno</option>
              <option>Agu-Awka</option>
              <option>Any Location</option>
            </select>
          </div>

          {/* Room Type */}
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

          {/* Budget */}
          <div className="relative">
            <BadgeDollarSign className="absolute left-4 top-4 text-gray-400" size={20} />
            <input 
              type="text"
              value={formData.budget}
              onChange={e => setFormData({...formData, budget: e.target.value})}
              placeholder="Your Budget (e.g. 150,000)"
              className="w-full p-4 pl-12 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium placeholder:font-normal"
            />
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
          disabled={loading || formData.description.length < 10}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
        >
          {loading ? 'Posting...' : (
            <>
              <Send size={20} /> Post Request
            </>
          )}
        </button>
      </form>
    </div>
  );
}
