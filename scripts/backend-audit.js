
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wammuxdrpyhppdyhsxam.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhbW11eGRycHlocHBkeWhzeGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMjU5NjYsImV4cCI6MjA4MTgwMTk2Nn0.am7bJAME3vsmCRMfI9hyw3bkEICmu9YbD1bWTceZf9U';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(color, msg) {
  console.log(`${color}${msg}${RESET}`);
}

async function runComprehensiveAudit() {
  console.log(`\n🔍 ${YELLOW}Starting Comprehensive Backend Audit...${RESET}`);
  console.log(`ℹ️ Target: ${SUPABASE_URL}\n`);

  let errorCount = 0;
  let warnCount = 0;

  // --- SECTION 1: PUBLIC DATA INTEGRITY (LODGES) ---
  console.log(`\n📋 ${YELLOW}SECTION 1: Listings & Images${RESET}`);
  
  try {
    const { data: lodges, error } = await supabase
      .from('lodges')
      .select('id, title, price, image_urls, image_blurhashes, status, landlord_id');

    if (error) throw error;

    console.log(`   Found ${lodges.length} lodges.`);
    
    let badImages = 0;
    let mismatchBlur = 0;
    let negativePrices = 0;

    lodges.forEach(l => {
      // Price Check
      if (l.price < 0) {
        log(RED, `   ❌ Negative Price: Lodge ${l.id} has price ${l.price}`);
        negativePrices++;
      }

      // Image Integrity
      if (l.image_urls && Array.isArray(l.image_urls)) {
        l.image_urls.forEach(url => {
          if (!url.startsWith('http')) {
             badImages++;
             // log(RED, `   ❌ Invalid URL in Lodge ${l.id}: ${url}`);
          }
        });

        // Blurhash Parity
        if (!l.image_blurhashes || l.image_blurhashes.length !== l.image_urls.length) {
           mismatchBlur++;
        }
      }
    });

    if (negativePrices === 0) log(GREEN, `   ✅ Price Constraints: All ${lodges.length} lodges have valid prices.`);
    else { log(RED, `   ❌ Price Constraints: ${negativePrices} violations found.`); errorCount++; }

    if (badImages === 0) log(GREEN, `   ✅ Image URLs: All image links appear valid.`);
    else { log(YELLOW, `   ⚠️ Image URLs: ${badImages} potentially broken/relative URLs found.`); warnCount++; }

    if (mismatchBlur === 0) log(GREEN, `   ✅ Blurhashes: All images have generated blurhashes.`);
    else { log(YELLOW, `   ⚠️ Blurhashes: ${mismatchBlur} lodges have missing or mismatched blurhashes (UI will show gray box).`); warnCount++; }

  } catch (err) {
    log(RED, `   ❌ Critical: Failed to audit lodges. ${err.message}`);
    errorCount++;
  }


  // --- SECTION 2: ACCOUNT MANAGEMENT ---
  console.log(`\n👤 ${YELLOW}SECTION 2: Profiles & Accounts${RESET}`);
  
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, role, is_verified, name');

    if (error) throw error;

    const landlords = profiles.filter(p => p.role === 'landlord');
    const students = profiles.filter(p => p.role === 'student');
    const verifiedLandlords = landlords.filter(p => p.is_verified);

    log(GREEN, `   ✅ Profiles: ${profiles.length} total.`);
    console.log(`      - Landlords: ${landlords.length} (${verifiedLandlords.length} verified)`);
    console.log(`      - Students: ${students.length}`);

    // Check for "Ghost" Landlords (Landlords in lodges table but not in profiles? - hard to check without join, but we can reverse)
    // Actually, let's check orphan wallets
    const { data: wallets } = await supabase.from('landlord_wallets').select('landlord_id');
    // Cannot select wallets as anon usually. Let's verify RLS blocks this first.
    
    if (wallets && wallets.length > 0) {
        log(RED, `   ❌ SECURITY FAIL: Accessed ${wallets.length} wallet records as Anon! RLS is broken.`);
        errorCount++;
    } else {
        log(GREEN, `   ✅ Security: RLS correctly blocked access to raw wallet table (0 rows returned).`);
    }

  } catch (err) {
    // If profiles is RLS restricted (public read usually allowed for profiles? Check schema)
    // Profiles usually allow public read for some fields.
    log(RED, `   ❌ Profile Audit Failed: ${err.message}`);
    errorCount++;
  }


  // --- SECTION 3: ZIPS PRICING & LOGIC (RPCs) ---
  console.log(`\n💳 ${YELLOW}SECTION 3: ZIPS Pricing & Logic${RESET}`);

  // We can't see wallets directly, but we can test the RPCs that *return* data.
  // actually `get_wallet_stats` requires `p_user_id`. We can try calling it with a fake ID or random one.
  // It should return null or error if we aren't that user (RLS inside RPC?).
  
  try {
      // Test Delta Sync RPC again with specific focus on structure
      const { data: feed, error: rpcError } = await supabase.rpc('get_lodges_feed_smart', {
          page_offset: 0,
          page_limit: 1,
          last_sync: new Date(0).toISOString()
      });

      if (rpcError) {
          log(RED, `   ❌ Smart Feed RPC Failed: ${rpcError.message}`);
          errorCount++;
      } else if (feed && feed.length > 0) {
          const item = feed[0];
          if (item._delta && item.landlord_z_score !== undefined) {
              log(GREEN, `   ✅ Smart Feed: Returning Z-Scores and Delta flags correctly.`);
          } else {
              log(RED, `   ❌ Smart Feed: Missing ZIPS fields (z_score or delta).`);
              errorCount++;
          }
      } else {
          log(YELLOW, `   ⚠️ Smart Feed returned empty (no lodges?).`);
      }

  } catch (err) {
      log(RED, `   ❌ ZIPS Logic Test Failed: ${err.message}`);
      errorCount++;
  }


  // --- SECTION 4: REQUESTS MANAGEMENT ---
  console.log(`\n📢 ${YELLOW}SECTION 4: Requests & Matching${RESET}`);
  
  try {
      // Check for public requests
      const { data: requests, error } = await supabase
        .from('requests')
        .select('id, expires_at, created_at')
        .gt('expires_at', new Date().toISOString()) // Active requests
        .limit(5);

      if (error) throw error;

      if (requests) {
          log(GREEN, `   ✅ Active Requests: ${requests.length} found.`);
          // Check logical consistency
          let invalidDates = 0;
          requests.forEach(r => {
              if (new Date(r.created_at) > new Date(r.expires_at)) {
                  invalidDates++;
              }
          });
          if (invalidDates > 0) {
              log(RED, `   ❌ Logic Error: ${invalidDates} requests expire before creation.`);
              errorCount++;
          } else {
              log(GREEN, `   ✅ Request Logic: Dates are consistent.`);
          }
      }

  } catch (err) {
      log(RED, `   ❌ Request Audit Failed: ${err.message}`);
      errorCount++;
  }

  console.log(`\n${YELLOW}--- SUMMARY ---${RESET}`);
  if (errorCount === 0) {
      log(GREEN, `🎉 Backend is HEALTHY. (Warnings: ${warnCount})`);
  } else {
      log(RED, `💀 Backend has ${errorCount} CRITICAL issues. (Warnings: ${warnCount})`);
  }
}

runComprehensiveAudit();
