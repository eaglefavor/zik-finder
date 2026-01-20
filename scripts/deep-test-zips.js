const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'https://zik-finder.vercel.app';
const EXECUTABLE_PATH = process.env.CHROMIUM_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser';
const SCREENSHOT_DIR = 'test-results';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)){
    fs.mkdirSync(SCREENSHOT_DIR);
}

(async () => {
  console.log(`🚀 Starting ZIPS Deep Test on: ${TARGET_URL}`);
  console.log(`ℹ️ Using Chromium: ${EXECUTABLE_PATH}`);

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: EXECUTABLE_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });

    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }, // Mobile viewport (iPhone X)
      userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
      serviceWorkers: 'allow' // Enable Service Workers
    });

    const page = await context.newPage();

    // --- LOGGING SETUP ---
    page.on('console', msg => {
      const text = msg.text();
      // Filter out noisy logs if needed, but for deep test we want everything
      console.log(`[BROWSER] ${msg.type().toUpperCase()}: ${text}`);
    });

    page.on('pageerror', err => {
      console.error(`[BROWSER CRASH] ${err.message}`);
    });

    page.on('requestfailed', request => {
      console.error(`[NETWORK FAIL] ${request.url()} - ${request.failure().errorText}`);
    });

    // --- TEST 1: BASELINE LOAD (4G) ---
    console.log('\n--- TEST 1: Baseline Load (Fast) ---');
    const cdpSession = await context.newCDPSession(page);
    
    // Reset network
    await cdpSession.send('Network.enable');
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });

    const start1 = Date.now();
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    const duration1 = Date.now() - start1;
    console.log(`✅ Baseline Loaded in ${duration1}ms`);
    
    await page.screenshot({ path: `${SCREENSHOT_DIR}/1-baseline.png` });
    console.log('📸 Screenshot: 1-baseline.png');

    // --- TEST 2: 3G SIMULATION (ZIPS CHECK) ---
    console.log('\n--- TEST 2: Slow 3G Simulation ---');
    
    // Simulate "Slow 3G"
    // Latency: 400ms, Download: 400kbps, Upload: 400kbps
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 400,
      downloadThroughput: 400 * 1024 / 8, 
      uploadThroughput: 400 * 1024 / 8,
    });
    console.log('📶 Network throttled to Slow 3G');

    // Navigate to a sub-page to force a fetch
    console.log('📄 Navigating to /market...');
    await page.goto(`${TARGET_URL}/market`, { waitUntil: 'domcontentloaded' });
    
    // Wait for the indicator (if it appears)
    try {
        // Click the dot to expand the status bar
        console.log('🖱️ Clicking Network Status Dot...');
        await page.waitForSelector('[data-testid="network-status-dot"]', { timeout: 5000 });
        await page.click('[data-testid="network-status-dot"]');
        await page.waitForSelector('[data-testid="network-status-bar"]', { state: 'visible', timeout: 2000 });

        // Look for the "ZIPS Active" or "Slow 2G/3G" text in the new System Bar
        const bodyText = await page.textContent('body');
        if (bodyText.includes('ZIPS Active') || bodyText.includes('3G')) {
            console.log('✅ SUCCESS: Network Indicator is visible!');
        } else {
            console.log('⚠️ WARNING: Network Indicator NOT found in body text.');
        }
    } catch (e) {
        console.log('⚠️ Error checking text content:', e.message);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/2-slow-3g.png` });
    console.log('📸 Screenshot: 2-slow-3g.png');


    // --- TEST 3: OFFLINE MODE (SERVICE WORKER CHECK) ---
    console.log('\n--- TEST 3: Offline Mode (PWA Check) ---');
    console.log('⏳ Waiting 10s for Service Worker to activate...');
    await page.waitForTimeout(10000); // Give SW time to cache

    // Check if SW is active
    const swStatus = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg ? reg.active ? 'active' : 'installing' : 'none';
    });
    console.log(`ℹ️ Service Worker Status: ${swStatus}`);
    
    await cdpSession.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    console.log('🔌 Network disconnected (Offline)');

    console.log('🔄 Reloading page...');
    try {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
        console.log('✅ SUCCESS: Page reloaded while offline (Service Worker active!)');
        
        // Click the dot to expand the status bar (Offline Mode)
        try {
            console.log('🖱️ Clicking Offline Status Dot...');
            await page.waitForSelector('[data-testid="network-status-dot"]', { timeout: 5000 });
            await page.click('[data-testid="network-status-dot"]');
            await page.waitForSelector('[data-testid="network-status-bar"]', { state: 'visible', timeout: 2000 });
        } catch (e) {
            console.log('⚠️ Could not click status dot in offline mode:', e.message);
        }

        // Verify "System Offline" text
        const offlineText = await page.textContent('body');
        if (offlineText.includes('System Offline') || offlineText.includes('Offline Mode')) {
             console.log('✅ SUCCESS: "System Offline" indicator visible.');
        } else {
             console.log('⚠️ WARNING: Offline indicator text not found.');
        }

    } catch (err) {
        console.error('❌ FAILURE: Page failed to load offline:', err.message);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/3-offline.png` });
    console.log('📸 Screenshot: 3-offline.png');

  } catch (error) {
    console.error('🔥 FATAL TEST ERROR:', error);
  } finally {
    if (browser) {
      await browser.close();
      console.log('\n🔒 Browser Closed.');
    }
  }
})();
