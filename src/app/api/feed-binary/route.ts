import { NextResponse } from 'next/server';
import { encode, decode } from '@msgpack/msgpack';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = 'https://wammuxdrpyhppdyhsxam.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhbW11eGRycHlocHBkeWhzeGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMjU5NjYsImV4cCI6MjA4MTgwMTk2Nn0.am7bJAME3vsmCRMfI9hyw3bkEICmu9YbD1bWTceZf9U';

export async function POST(request: Request) {
  try {
    const buffer = await request.arrayBuffer();
    let payload: unknown;
    
    try {
        payload = decode(new Uint8Array(buffer));
    } catch (decodeError) {
        console.warn('MsgPack decode failed, trying JSON:', (decodeError as Error).message, 'Buffer size:', buffer.byteLength);
        try {
            const text = new TextDecoder().decode(buffer);
            payload = JSON.parse(text);
        } catch (jsonError) {
            console.error('JSON decode also failed:', (jsonError as Error).message);
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }
    }

    const { page_offset = 0, page_limit = 10, last_sync } = payload as { page_offset?: number, page_limit?: number, last_sync?: string };

    // Direct fetch to Supabase RPC (Bypassing supabase-js)
    const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/get_lodges_feed_smart`;
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        page_offset,
        page_limit,
        last_sync: last_sync || '1970-01-01T00:00:00Z'
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Supabase RPC Error:', response.status, errorText);
        return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();

    const encodedData = encode(data);

    return new NextResponse(encodedData, {
      headers: {
        'Content-Type': 'application/x-msgpack',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error: unknown) {
    console.error('Binary Feed API Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
