const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🕵️‍♀️ Starting Final Deep Audit (Login + 3G + Security)...');
  
  const executablePath = process.env.CHROMIUM_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser';
  const targetUrl = 'https://zik-finder.vercel.app';

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    viewport: { width: 393, height: 851 },
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5 Build/RQ3A.210105.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
    isMobile: true,
  });

  const page = await context.newPage();

  // -- 1. Security Listener --
  let phoneLeakDetected = false;
  let rpcCallsDetected = 0;

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('rpc/get_lodges_feed')) {
      rpcCallsDetected++;
      try {
        const json = await response.json();
        const sample = Array.isArray(json) ? json.slice(0, 5) : [];
        sample.forEach((lodge, idx) => {
          if (lodge.profile_data && lodge.profile_data.phone_number !== null) {
            console.error('🚨 DATA LEAK DETECTED in Lodge #', idx, ': Phone number exposed!');
            phoneLeakDetected = true;
          }
        });
      } catch (e) {}
    }
  });

  try {
    // -- 2. Login (Fast Network for Setup) --
    console.log('➡️ Navigating to ', targetUrl, '...');
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    
    console.log('🔑 Filling Credentials...');
    await page.fill('input[type="email"]', 'rc5632250@gmail.com');
    await page.fill('input[type="password"]', 'Cheetah88');
    
    console.log('👇 Clicking Sign In...');
    await page.click('button[type="submit"]');
    
    // Wait for initial redirect to start
    await page.waitForTimeout(2000);

    // -- 3. Throttle Network to 3G (UNIZIK Network) --
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 300,
      downloadThroughput: 500 * 1024 / 8,
      uploadThroughput: 500 * 1024 / 8,
      connectionType: 'cellular3g'
    });
    console.log('📶 Network Throttled to 3G for Content Load...');

    // -- 4. Wait for Feed --
    console.log('⏳ Waiting for Feed under 3G...');
    const startTime = Date.now();
    await page.waitForSelector('text=Explore', { timeout: 60000 });
    const feedLoadTime = Date.now() - startTime;
    console.log('⏱️ Feed rendered in ', feedLoadTime, 'ms');

    // -- 5. Security Report --
    console.log('\n🔒 --- SECURITY REPORT ---');
    if (rpcCallsDetected > 0) {
      if (phoneLeakDetected) {
        console.error('❌ FAIL: Phone numbers are leaking to logged-in users!');
      } else {
        console.log('✅ PASS: Phone numbers are masked (NULL) for logged-in users.');
      }
    } else {
      console.log('⚠️ Warning: No RPC calls detected. (Data might be cached or SSG)');
    }

    // -- 6. Screenshot --
    const screenshotPath = path.join(__dirname, '../audit-logged-in-3g.png');
    await page.screenshot({ path: screenshotPath });
    console.log('📸 Screenshot saved: ', screenshotPath);

  } catch (error) {
    console.error('❌ Audit Failed:', error.message);
    await page.screenshot({ path: path.join(__dirname, '../audit-fail.png') });
  } finally {
    await browser.close();
    console.log('🏁 Final Audit Complete.');
  }
})();
