import { encode, decode } from '@msgpack/msgpack';

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
    return decode(new Uint8Array(await res.arrayBuffer()));
  }
};
