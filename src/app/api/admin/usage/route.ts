import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import cloudinary from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Check Authentication (must be Admin)
    // We expect the session token in the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role from profiles (manual RLS check since we might use admin client next)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    // 2. Fetch Cloudinary Usage
    // Credits: 25GB usually = 25 Credits. 1 Credit = 1GB bandwidth or 1GB storage or 1000 transformations.
    // We'll focus on storage.
    let cloudinaryUsage = {
      storage_usage: 0, // bytes
      credit_usage: 0, // percentage or number
      plan_limit: 25 * 1024 * 1024 * 1024 // Assuming 25GB limit for free tier approximation
    };

    try {
      const result = await cloudinary.api.usage();
      // usage() returns object with keys like 'storage', 'bandwidth', 'credits'
      if (result) {
        cloudinaryUsage.storage_usage = result.storage?.usage || 0;
        cloudinaryUsage.credit_usage = result.credits?.usage || 0;
        // If plan limit is available, use it, otherwise keep default
        if (result.storage?.limit) cloudinaryUsage.plan_limit = result.storage.limit;
      }
    } catch (err) {
      console.error('Cloudinary Usage Error:', err);
      // Don't fail the whole request, just return partial data
    }

    // 3. Fetch Supabase Storage Usage
    // We need Service Role to query storage.objects globally if RLS restricts listing all files
    // But since we are calculating global usage, we definitely need Service Role/Admin access.
    // Assuming SUPABASE_SERVICE_ROLE_KEY is set in Vercel. If not, this might fail or return 0.
    
    // Fallback: If service role missing, use the passed user token (admin) which might have RLS to view all files
    // But standard RLS usually restricts "view own files".
    
    // We'll try to query `storage.objects` metadata.
    // Since we don't have the Service Role Key hardcoded or guaranteed, we will rely on the Admin User's
    // ability to potentially see files if RLS allows Admins (which our init.sql usually does).
    
    const { data: files, error: storageError } = await supabase
      .from('objects')
      .select('metadata')
      .schema('storage');

    let supabaseSize = 0;
    if (!storageError && files) {
      supabaseSize = (files as any[]).reduce((acc: number, file: any) => {
        return acc + (file.metadata?.size || 0);
      }, 0);
    } else {
      console.warn('Supabase Storage Calc Error:', storageError);
    }

    return NextResponse.json({
      cloudinary: {
        used: cloudinaryUsage.storage_usage,
        limit: cloudinaryUsage.plan_limit,
      },
      supabase: {
        used: supabaseSize,
        limit: 1 * 1024 * 1024 * 1024 // 1GB default free tier
      }
    });

  } catch (error: any) {
    console.error('Usage Monitor Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
