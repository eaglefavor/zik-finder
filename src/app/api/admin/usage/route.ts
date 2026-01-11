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
    if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
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
    } else {
      console.warn('Skipping Cloudinary stats: Missing API credentials');
    }

    // 3. Fetch Supabase Usage via RPC
    try {
      const { data: stats, error: rpcError } = await supabase.rpc('get_storage_stats');
      
      if (rpcError) {
        console.error('Supabase Stats RPC Error:', rpcError);
      } else if (stats) {
        // stats is { total_bytes: number, file_count: number }
        supabaseSize = stats.total_bytes || 0;
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
        limit: 1024 * 1024 * 1024 // 1GB default
      }
    });

  } catch (error: unknown) {
    console.error('Usage Monitor Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}