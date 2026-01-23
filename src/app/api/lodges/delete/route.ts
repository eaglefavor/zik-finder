import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import cloudinary from '@/lib/cloudinary';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { lodgeId, userId } = await request.json();
    const authHeader = request.headers.get('Authorization');

    if (!lodgeId || !userId || !authHeader) {
      return NextResponse.json({ error: 'Missing lodgeId, userId, or Authorization header' }, { status: 400 });
    }

    // 1. Create Authenticated Client (User Context)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
    });

    // 2. Fetch Lodge (Verify Ownership via RLS implicitly or explicit check)
    // We select image_urls to clean up Cloudinary
    const { data: lodge, error: fetchError } = await supabase
      .from('lodges')
      .select('landlord_id, image_urls, lodge_units(image_urls)')
      .eq('id', lodgeId)
      .single();

    if (fetchError || !lodge) {
      return NextResponse.json({ 
        error: `Fetch failed: ${fetchError?.message || 'Lodge not found or access denied'}`, 
      }, { status: 404 });
    }

    if (lodge.landlord_id !== userId) {
         return NextResponse.json({ error: 'Forbidden: ID Mismatch' }, { status: 403 });
    }

    // 3. Clean up Cloudinary (Best Effort)
    // We try to clean up images, but if this fails (e.g. invalid keys), we still proceed to delete the lodge record.
    try {
        const allUrls = [...(lodge.image_urls || [])];
        if (lodge.lodge_units) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            lodge.lodge_units.forEach((unit: any) => {
                if (unit.image_urls) allUrls.push(...unit.image_urls);
            });
        }

        if (allUrls.length > 0) {
            const publicIds = Array.from(new Set(allUrls.map((url: string) => {
                const parts = url.split('/');
                const filename = parts.pop();
                if (!filename) return null;
                return filename.split('.')[0]; 
            }))).filter((id): id is string => id !== null);

            if (publicIds.length > 0) {
                await cloudinary.api.delete_resources(publicIds);
            }
        }
    } catch (cloudError) {
        console.error('Cloudinary cleanup warning:', cloudError);
        // Continue to DB deletion
    }

    // 4. Delete Lodge (User Context)
    // RLS policy "Landlords can delete their own lodges" must be active
    const { error: deleteError } = await supabase
      .from('lodges')
      .delete()
      .eq('id', lodgeId);

    if (deleteError) {
      throw deleteError;
    }
    
    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
