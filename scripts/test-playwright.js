const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  console.log('🚀 Launching Playwright with System Chromium...');
  
  const executablePath = process.env.CHROMIUM_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser';
  
  if (!executablePath) {
    console.error('❌ CHROMIUM_PATH not found in env.');
    process.exit(1);
  }

  console.log(`ℹ️ Using Executable: ${executablePath}`);

  try {
    const browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu']
    });

    console.log('✅ Browser Launched!');
    
    const page = await browser.newPage();
    console.log('📄 Navigating to google.com...');
    await page.goto('https://google.com');
    
    const title = await page.title();
    console.log(`📝 Page Title: ${title}`);
    
    await browser.close();
    console.log('🔒 Browser Closed.');
    
  } catch (error) {
    console.error('❌ Playwright Error:', error);
    process.exit(1);
  }
})();
