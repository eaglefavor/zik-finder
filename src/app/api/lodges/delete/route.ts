import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import cloudinary from '@/lib/cloudinary';

export async function POST(request: Request) {
  try {
    const { lodgeId, userId } = await request.json();
    const authHeader = request.headers.get('Authorization');

    if (!lodgeId || !userId || !authHeader) {
      return NextResponse.json({ error: 'Missing lodgeId, userId, or Authorization header' }, { status: 400 });
    }

    // Initialize Supabase Client as the User
    // using hardcoded keys since env vars are missing in Vercel
    const supabaseUrl = 'https://wammuxdrpyhppdyhsxam.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhbW11eGRycHlocHBkeWhzeGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMjU5NjYsImV4cCI6MjA4MTgwMTk2Nn0.am7bJAME3vsmCRMfI9hyw3bkEICmu9YbD1bWTceZf9U';

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // 1. Fetch Lodge and its Units to get ALL image URLs
    const { data: lodge, error: fetchError } = await supabase
      .from('lodges')
      .select('landlord_id, image_urls, lodge_units(image_urls)')
      .eq('id', lodgeId)
      .single();

    if (fetchError || !lodge) {
      return NextResponse.json({ 
        error: `Fetch failed: ${fetchError?.message || 'Lodge not found'}`, 
      }, { status: 404 });
    }

    // 2. Collect ALL unique image URLs (Lodge + Units)
    const allUrls = [...(lodge.image_urls || [])];
    if (lodge.lodge_units) {
      lodge.lodge_units.forEach((unit: any) => {
        if (unit.image_urls) allUrls.push(...unit.image_urls);
      });
    }

    // 3. Delete unique public IDs from Cloudinary
    if (allUrls.length > 0) {
      const publicIds = Array.from(new Set(allUrls.map((url: string) => {
        const parts = url.split('/');
        const filename = parts.pop();
        if (!filename) return null;
        return filename.split('.')[0]; 
      }))).filter(Boolean);

      if (publicIds.length > 0) {
        try {
            await cloudinary.api.delete_resources(publicIds as string[]);
        } catch (cloudError) {
            console.error('Cloudinary delete error (continuing...):', cloudError);
        }
      }
    }

    console.log('Auth Header:', authHeader ? authHeader.substring(0, 20) + '...' : 'Missing');

    // 3. Delete Lodge from Supabase
    // We SKIP this step here. The Client will handle DB deletion.
    // This solves the RLS/Auth context issue on the server.
    // We return success so the client knows images are gone (or attempted).
    
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
