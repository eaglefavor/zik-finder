'use client';

import { supabase } from '@/lib/supabase';
import { useState } from 'react';

export default function VersionCheck() {
  const [status, setStatus] = useState('Waiting...');

  const testInsert = async () => {
    setStatus('Inserting...');
    const { error } = await supabase.from('notifications').insert({
      // We don't have a user ID here easily unless we fetch it, 
      // but let's see if we can trigger an error or something.
      // Actually, let's just show text.
    });
    // This is just a visual test.
  };

  return (
    <div className="p-10 flex flex-col items-center justify-center min-h-screen bg-white text-black">
      <h1 className="text-4xl font-bold mb-4 text-purple-600">DEPLOYMENT CONFIRMED</h1>
      <p className="text-xl mb-4">Version: v4 (Purple Button Fix)</p>
      <p className="mb-4">Time: {new Date().toISOString()}</p>
      <div className="p-4 bg-gray-100 rounded">
        If you see this, the code IS live.
      </div>
    </div>
  );
}
