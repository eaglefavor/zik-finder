const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🕵️‍♀️ Starting Deep Audit for ZikLodge (Guest Mode)...');
  
  const executablePath = process.env.CHROMIUM_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser';
  // Target with guest param
  const targetUrl = 'https://zik-finder.vercel.app/?guest=true';

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    viewport: { width: 393, height: 851 },
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5 Build/RQ3A.210105.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();
  
  // -- 1. Network Security Listener --
  let phoneLeakDetected = false;
  let rpcCallsDetected = 0;

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('rpc/get_lodges_feed')) {
      rpcCallsDetected++;
      try {
        const json = await response.json();
        // Check first 5 items
        const sample = Array.isArray(json) ? json.slice(0, 5) : [];
        
        sample.forEach((lodge, idx) => {
          if (lodge.profile_data && lodge.profile_data.phone_number !== null) {
            console.error(`🚨 DATA LEAK DETECTED in Lodge #${idx} (${lodge.title}): Phone number exposed!`);
            phoneLeakDetected = true;
          }
        });
      } catch (e) {
        // Ignore
      }
    }
  });

  try {
    // -- 2. Navigation --
    console.log(`➡️ Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    
    // -- 3. Verify Feed Visibility --
    const feedVisible = await page.isVisible('text=Explore');
    console.log(`🎨 UI Check: "Explore" Header is ${feedVisible ? 'Visible ✅' : 'Missing ❌'}`);
    
    if (feedVisible) {
        console.log('✅ Guest Bypass Successful: Feed is visible.');
    } else {
        console.error('❌ Guest Bypass Failed: Still stuck on Auth Screen?');
    }

    // -- 4. Security Verification --
    console.log('\n🔒 --- SECURITY REPORT ---');
    if (rpcCallsDetected > 0) {
        if (phoneLeakDetected) {
            console.error('❌ FAIL: Phone numbers are leaking to guests!');
        } else {
            console.log('✅ PASS: Phone numbers are masked (NULL) for guests.');
        }
    } else {
        console.log('⚠️ Warning: No RPC calls detected (likely cached/SSG/ISR). Cannot verify leak via network.');
    }

    // -- 5. Screenshot --
    const screenshotPath = path.join(__dirname, '../guest-audit-screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Screenshot saved to: ${screenshotPath}`);

  } catch (error) {
    console.error('❌ Audit Failed:', error);
  } finally {
    await browser.close();
    console.log('🏁 Audit Complete.');
  }
})();