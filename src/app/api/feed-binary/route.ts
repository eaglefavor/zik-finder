import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encode, decode } from '@msgpack/msgpack';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: Request) {
  try {
    // 1. Parse Input (MsgPack)
    // We expect the request body to be binary msgpack
    const buffer = await request.arrayBuffer();
    let payload: any;
    
    try {
        payload = decode(new Uint8Array(buffer));
    } catch (e) {
        // Fallback for debugging if JSON is sent
        try {
            const text = new TextDecoder().decode(buffer);
            payload = JSON.parse(text);
        } catch {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }
    }

    const { page_offset = 0, page_limit = 10, last_sync } = payload;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

  } catch (error: any) {
    console.error('Binary Feed API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
