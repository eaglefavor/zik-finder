import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import cloudinary from '@/lib/cloudinary';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    const authHeader = request.headers.get('Authorization');

    if (!userId || !authHeader) {
      return NextResponse.json({ error: 'Missing userId or Authorization header' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Fetch user profile to get the avatar_url
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (fetchError || !profile?.avatar_url) {
      return NextResponse.json({ success: true, message: 'No image to delete' });
    }

    // 2. Extract public ID and delete from Cloudinary
    if (profile.avatar_url.includes('cloudinary')) {
      const filename = profile.avatar_url.split('/').pop();
      if (filename) {
        const publicId = filename.split('.')[0];
        await cloudinary.api.delete_resources([publicId]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Profile image delete error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
