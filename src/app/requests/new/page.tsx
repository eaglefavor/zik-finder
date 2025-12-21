'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Send, MapPin, BadgeDollarSign } from 'lucide-react';
import Link from 'next/link';
import { useData } from '@/lib/data-context';
import { useAppContext } from '@/lib/context';

export default function NewRequest() {
  const router = useRouter();
  const { addRequest } = useData();
  const { user } = useAppContext();
  const [submitted, setSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    location: 'Ifite (School Gate Area)',
    budget_range: '150k - 250k',
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    await addRequest({
      location: formData.location,
      budget_range: formData.budget_range,
      description: formData.description || 'No description provided.',
    });

    setSubmitted(true);
    setTimeout(() => router.push('/market'), 2000); // Redirect to Market to see the post
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
        <Link href="/" className="p-2 bg-white rounded-full shadow-sm border border-gray-100">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">What are you looking for?</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-blue-50 p-5 rounded-3xl mb-4 border border-blue-100">
          <p className="text-sm text-blue-700 leading-relaxed">
            Can't find what you need? Post a request and landlords with matching lodges will contact you directly.
          </p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <MapPin className="absolute left-4 top-4 text-gray-400" size={20} />
            <select 
              value={formData.location}
              onChange={e => setFormData({...formData, location: e.target.value})}
              className="w-full p-4 pl-12 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
            >
              <option>Ifite (School Gate Area)</option>
              <option>Amansea</option>
              <option>Temp Site</option>
              <option>Okpuno</option>
            </select>
          </div>

          <div className="relative">
            <BadgeDollarSign className="absolute left-4 top-4 text-gray-400" size={20} />
            <select 
              value={formData.budget_range}
              onChange={e => setFormData({...formData, budget_range: e.target.value})}
              className="w-full p-4 pl-12 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
            >
              <option>Under 150k</option>
              <option>150k - 250k</option>
              <option>250k - 400k</option>
              <option>400k+</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 ml-1">Describe your ideal lodge</label>
            <textarea 
              rows={4}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="e.g. I need a self-con in Ifite with steady water and a gated compound. Budget is flexible if the place is nice."
              className="w-full p-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <button 
          type="submit"
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 mt-4"
        >
          <Send size={20} /> Post Request
        </button>
      </form>
    </div>
  );
}
