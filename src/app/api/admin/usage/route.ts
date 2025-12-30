import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import cloudinary from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
      const result = await cloudinary.api.usage();
      if (result) {
        storage_usage = result.storage?.usage || 0;
        if (result.storage?.limit) plan_limit = result.storage.limit;
      }
    } catch (err: unknown) {
      console.error('Cloudinary Usage Error:', err instanceof Error ? err.message : err);
      // Don't fail, just keep 0
    }

    // 3. Fetch Supabase Usage
    try {
      // Accessing the storage schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: files, error: storageError } = await (supabase as unknown as SupabaseClient<any, 'storage'>)
        .from('objects')
        .select('metadata');

      if (!storageError && files && Array.isArray(files)) {
        supabaseSize = files.reduce((acc: number, file: { metadata?: { size?: number } }) => {
          return acc + (file.metadata?.size || 0);
        }, 0);
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