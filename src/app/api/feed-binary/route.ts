/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { encode, decode } from '@msgpack/msgpack';
import { LODGE_KEYS } from '@/lib/protocol/schema';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = supabaseUrl;
const SUPABASE_ANON_KEY = supabaseAnonKey;

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

    // Schema Compaction (Strings -> Integers)
    const compressedData = Array.isArray(data) ? data.map((item: any) => {
        const compressedItem: Record<string | number, any> = {};
        for (const key in item) {
            if (key in LODGE_KEYS) {
                compressedItem[LODGE_KEYS[key as keyof typeof LODGE_KEYS]] = item[key];
            } else {
                // Keep unknown keys as strings (fallback)
                compressedItem[key] = item[key];
            }
        }
        return compressedItem;
    }) : data;

    const encodedData = encode(compressedData);

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