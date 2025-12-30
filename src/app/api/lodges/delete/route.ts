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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
      lodge.lodge_units.forEach((unit: { image_urls: string[] }) => {
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
      }))).filter((id): id is string => id !== null);

      if (publicIds.length > 0) {
        try {
            await cloudinary.api.delete_resources(publicIds);
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

  } catch (error: unknown) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
