import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import cloudinary from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = 'https://wammuxdrpyhppdyhsxam.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhbW11eGRycHlocHBkeWhzeGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMjU5NjYsImV4cCI6MjA4MTgwMTk2Nn0.am7bJAME3vsmCRMfI9hyw3bkEICmu9YbD1bWTceZf9U';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    // Initialize defaults
    let storage_usage = 0;
    let plan_limit = 25 * 1024 * 1024 * 1024;
    let supabaseSize = 0;

    // 2. Fetch Cloudinary Usage
    try {
      console.log('Fetching Cloudinary usage...');
      const result = await cloudinary.api.usage();
      if (result) {
        storage_usage = result.storage?.usage || 0;
        if (result.storage?.limit) plan_limit = result.storage.limit;
        console.log('Cloudinary usage fetched:', storage_usage);
      }
    } catch (err: unknown) {
      console.error('Cloudinary Usage Error:', err instanceof Error ? err.message : err);
      // Don't fail, just keep 0
    }

    // 3. Fetch Supabase Usage
    try {
      console.log('Fetching Supabase storage metadata...');
      // Accessing the storage schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: files, error: storageError } = await (supabase as SupabaseClient<any, 'storage'>)
        .from('objects')
        .select('metadata');

      if (!storageError && files && Array.isArray(files)) {
        supabaseSize = files.reduce((acc: number, file: { metadata?: { size?: number } }) => {
          return acc + (file.metadata?.size || 0);
        }, 0);
        console.log('Supabase usage calculated:', supabaseSize);
      } else {
        console.error('Supabase Storage Query Error:', storageError);
      }
    } catch (err: unknown) {
      console.error('Supabase Usage Calculation Error:', err instanceof Error ? err.message : err);
    }

    return NextResponse.json({
      cloudinary: {
        used: storage_usage,
        limit: plan_limit,
      },
      supabase: {
        used: supabaseSize,
        limit: 1024 * 1024 * 1024
      }
    });

  } catch (error: unknown) {
    console.error('Usage Monitor Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}