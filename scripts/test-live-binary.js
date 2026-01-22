
const { encode, decode } = require('@msgpack/msgpack');

const ENDPOINT = 'https://zik-finder.vercel.app/api/feed-binary';

async function testBinaryProtocol() {
  console.log('🧪 Testing Binary Protocol (MessagePack)...');
  console.log(`Target: ${ENDPOINT}`);

  // 1. Prepare Payload
  const payload = {
    page_offset: 0,
    page_limit: 5,
    last_sync: '1970-01-01T00:00:00Z' // Force full sync
  };

  console.log('📦 Encoding payload:', payload);
  const buffer = encode(payload);
  console.log(`🔹 Payload size: ${buffer.byteLength} bytes`);

  try {
    // 2. Send Request
    const startTime = Date.now();
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-msgpack',
        'Accept': 'application/x-msgpack'
      },
      body: buffer
    });

    const duration = Date.now() - startTime;
    console.log(`
📡 Status: ${response.status} ${response.statusText}`);
    console.log(`⏱️ Duration: ${duration}ms`);

    if (!response.ok) {
        const text = await response.text();
        console.error('❌ Server Error Body:', text);
        return;
    }

    // 3. Decode Response
    const resBuffer = await response.arrayBuffer();
    console.log(`🔹 Response size: ${resBuffer.byteLength} bytes`);
    
    if (resBuffer.byteLength === 0) {
        console.warn('⚠️ Warning: Empty response buffer');
        return;
    }

    const decoded = decode(new Uint8Array(resBuffer));
    
    // 4. Verify Data
    if (Array.isArray(decoded)) {
        console.log(`✅ Success! Received ${decoded.length} items.`);
        if (decoded.length > 0) {
            const first = decoded[0];
            console.log('📝 Sample Item:', {
                id: first.id,
                title: first.title,
                delta: first._delta,
                keys: Object.keys(first).length
            });
        }
    } else {
        console.log('❓ Received non-array data:', decoded);
    }

  } catch (err) {
    console.error('❌ Client Error:', err);
  }
}

testBinaryProtocol();
