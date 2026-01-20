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
    
    const decoded = decode(new Uint8Array(await res.arrayBuffer()));

    // Schema Decompression (Integers -> Strings)
    if (Array.isArray(decoded)) {
      return decoded.map((item: any) => {
        const decompressedItem: Record<string, any> = {};
        for (const key in item) {
          const numericKey = Number(key);
          if (numericKey in LODGE_KEYS_REVERSE) {
            // @ts-ignore
            decompressedItem[LODGE_KEYS_REVERSE[numericKey]] = item[key];
          } else {
            // Keep unknown keys as is
            decompressedItem[key] = item[key];
          }
        }
        return decompressedItem;
      });
    }

    return decoded;
  }
};
