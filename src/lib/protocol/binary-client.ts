/* eslint-disable @typescript-eslint/no-explicit-any */
import { encode, decode } from '@msgpack/msgpack';
import { LODGE_KEYS_REVERSE } from './schema';

export const BinaryProtocol = {
  // Decode server response
  decode: async (response: Response) => {
    const buffer = await response.arrayBuffer();
    return decode(new Uint8Array(buffer));
  },

  // Encode payload for request
  encode: (data: unknown) => {
    return encode(data);
  },

  // Helper to fetch with binary protocol
  fetch: async (url: string, body: unknown) => {
    const encoded = encode(body);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-msgpack',
        'Accept': 'application/x-msgpack'
      },
      body: encoded
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error('Binary Fetch Error Body:', text);
      throw new Error(`Binary Fetch Failed: ${res.status} - ${text.slice(0, 100)}`);
    }

    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/x-msgpack')) {
      const text = await res.text();
      throw new Error(`Invalid content type: expected binary msgpack, got "${contentType}". Body: ${text.slice(0, 100)}`);
    }
    
    const decoded = decode(new Uint8Array(await res.arrayBuffer()));

    // Handle potential error response from server (e.g. { error: "..." })
    if (decoded && typeof decoded === 'object' && !Array.isArray(decoded) && 'error' in decoded) {
        throw new Error(`Binary API Error: ${(decoded as any).error}`);
    }

    // Schema Decompression (Integers -> Strings)
    if (Array.isArray(decoded)) {
      return decoded.map((item: any) => {
        if (typeof item !== 'object' || item === null) return item;
        
        const decompressedItem: Record<string, any> = {};
        for (const key in item) {
          const numericKey = Number(key);
          if (!isNaN(numericKey)) {
             if (numericKey in LODGE_KEYS_REVERSE) {
                decompressedItem[LODGE_KEYS_REVERSE[numericKey]] = item[key];
             } else {
                // Warning for unknown keys - indicates schema mismatch
                console.warn(`Binary Protocol: Unknown key ID ${numericKey} received. Frontend schema may be outdated.`);
                decompressedItem[key] = item[key];
             }
          } else {
            // String keys (already decompressed or metadata)
            decompressedItem[key] = item[key];
          }
        }
        return decompressedItem;
      });
    }

    return decoded;
  }
};
