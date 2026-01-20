import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encode, decode } from '@msgpack/msgpack';

export const dynamic = 'force-dynamic';

// Fallback to hardcoded keys if env vars are missing (Fix for Vercel deployment)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wammuxdrpyhppdyhsxam.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhbW11eGRycHlocHBkeWhzeGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMjU5NjYsImV4cCI6MjA4MTgwMTk2Nn0.am7bJAME3vsmCRMfI9hyw3bkEICmu9YbD1bWTceZf9U';

export async function POST(request: Request) {
  try {
    // 1. Parse Input (MsgPack)
    // We expect the request body to be binary msgpack
    const buffer = await request.arrayBuffer();
    let payload: unknown;
    
    try {
        payload = decode(new Uint8Array(buffer));
    } catch {
        // Fallback for debugging if JSON is sent
        try {
            const text = new TextDecoder().decode(buffer);
            payload = JSON.parse(text);
        } catch {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }
    }

    const { page_offset = 0, page_limit = 10, last_sync } = payload as { page_offset?: number, page_limit?: number, last_sync?: string };

    console.log(`[BinaryAPI] Init Supabase with: URL=${SUPABASE_URL}, Key=${SUPABASE_ANON_KEY.slice(0, 10)}...`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    });

    // 2. Call Smart RPC
    // We pass the last_sync timestamp to get delta updates
    const { data, error } = await supabase.rpc('get_lodges_feed_smart', {
      page_offset,
      page_limit,
      last_sync: last_sync || '1970-01-01T00:00:00Z'
    });

    if (error) {
        console.error('Smart Feed Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Encode Response (MsgPack)
    const encodedData = encode(data);

    // 4. Return Binary Stream
    return new NextResponse(encodedData, {
      headers: {
        'Content-Type': 'application/x-msgpack',
        'Cache-Control': 'no-store' // Dynamic data
      }
    });

  } catch (error: unknown) {
    console.error('Binary Feed API Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
