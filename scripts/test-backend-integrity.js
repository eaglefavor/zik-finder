
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wammuxdrpyhppdyhsxam.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhbW11eGRycHlocHBkeWhzeGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMjU5NjYsImV4cCI6MjA4MTgwMTk2Nn0.am7bJAME3vsmCRMfI9hyw3bkEICmu9YbD1bWTceZf9U';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runTests() {
  console.log('🚀 Starting Backend Integrity Tests...');
  console.log(`ℹ️ Target: ${SUPABASE_URL}`);

  let testLodgeId = null;

  // --- TEST 1: Public Table Access ---
  console.log('\n--- TEST 1: Public Table Access (lodges) ---');
  try {
    const { data, error } = await supabase
      .from('lodges')
      .select('id, title')
      .limit(1)
      .single();

    if (error) throw error;
    if (!data) throw new Error('No lodges found in database.');

    console.log('✅ Success: Accessed "lodges" table.');
    console.log(`📝 Sample Lodge: ${data.title} (${data.id})`);
    testLodgeId = data.id;
  } catch (err) {
    console.error('❌ FAIL: Could not access lodges table.', err.message);
    process.exit(1);
  }

  // --- TEST 2: Delta Sync RPC ---
  console.log('\n--- TEST 2: Delta Sync RPC (get_lodges_feed_smart) ---');
  try {
    // timestamp 0 to get full snapshot
    const { data, error } = await supabase.rpc('get_lodges_feed_smart', {
      page_offset: 0,
      page_limit: 10,
      last_sync: new Date(0).toISOString()
    });

    if (error) throw error;
    
    // Check if it matches expected MessagePack-ready structure (or JSON)
    // The RPC might return JSON directly.
    if (Array.isArray(data)) {
        console.log(`✅ Success: RPC returned ${data.length} items.`);
        const first = data[0];
        if (first.id && first.updated_at) {
             console.log('✅ Structure Check: Valid (has id, updated_at).');
        } else {
             console.warn('⚠️ Warning: RPC return structure might be missing fields.', Object.keys(first));
        }
    } else {
        console.log('ℹ️ RPC returned non-array data (possibly direct MessagePack bytes?).', typeof data);
    }

  } catch (err) {
    console.error('❌ FAIL: Delta Sync RPC failed.', err.message);
  }

  // --- TEST 3: View Increment RPC ---
  if (testLodgeId) {
      console.log('\n--- TEST 3: View Increment RPC (increment_lodge_view) ---');
      try {
        const { error } = await supabase.rpc('increment_lodge_view', {
            p_lodge_id: testLodgeId,
            p_viewer_id: null // Anon view
        });

        if (error) throw error;
        console.log('✅ Success: Incremented view count for lodge.');
      } catch (err) {
        console.error('❌ FAIL: View Increment failed.', err.message);
      }
  }

  // --- TEST 4: RLS Check (Wallet) ---
  console.log('\n--- TEST 4: RLS Security Check (Wallet) ---');
  try {
      // Trying to access sensitive wallet data as anon
      const { data, error } = await supabase
        .from('landlord_wallets')
        .select('*')
        .limit(1);

      if (error) {
          // Expecting an error or empty data depending on policy
          console.log(`✅ Success: RLS prevented access (Error: ${error.message} - ${error.code})`);
      } else if (data.length === 0) {
          console.log('✅ Success: RLS returned 0 rows for anon user.');
      } else {
          console.error('❌ CRITICAL FAIL: Anon user accessed wallet data!', data);
      }
  } catch (err) {
      console.log('✅ Success: RLS prevented access (Exception).');
  }

  console.log('\n🏁 Tests Completed.');
}

runTests();
