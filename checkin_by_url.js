const puppeteer = require('puppeteer');
const cron = require('node-cron');

// Timestamp utilities (local time)
function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}
const log = (...args) => console.log(`[${ts()}]`, ...args);
const logError = (...args) => console.error(`[${ts()}]`, ...args);

// Helper: find a frame that contains a selector
async function findFrameWithSelector(page, selector, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // Check main frame first
    const inMain = await page.$(selector);
    if (inMain) return page.mainFrame();

    // Check child frames
    for (const frame of page.frames()) {
      try {
        const handle = await frame.$(selector);
        if (handle) return frame;
      } catch (_) {}
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timeout waiting for selector in any frame: ${selector}`);
}

// Usage:
// 1) Set env vars NLB_USERNAME and NLB_PASSWORD
// 2) Provide booking number via env NLB_BOOKING_NUMBER or CLI arg: node checkin_by_url.js 792
//    This will open https://www.nlb.gov.sg/seatbooking/?loc=NLB.LKCRL11.11.BookingAreaZoneD1.<NUMBER>
// 3) Script waits ~10 seconds for auto check-in UI then closes the browser

async function runPuppeteerByUrl() {
  const bookingNumber = process.env.NLB_BOOKING_NUMBER || process.argv[2] || '792';
  const targetUrl = `https://www.nlb.gov.sg/seatbooking/?loc=NLB.LKCRL11.11.BookingAreaZoneD1.${bookingNumber}`;

  try {
    log(`[NLB] Check-in by URL starting... number=${bookingNumber}`);
    const headlessMode = process.env.HEADLESS === 'true' ? 'new' : true; // use 'new' headless when enabled
    const browser = await puppeteer.launch({
      headless: headlessMode,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,1024',
      ],
      defaultViewport: { width: 1280, height: 1024 },
    });

    const page = await browser.newPage();
    // Standard desktop UA helps some SSO pages in headless
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    // Always allow geolocation for NLB to avoid the permission prompt
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://www.nlb.gov.sg', ['geolocation']);
    await context.overridePermissions('https://www.nlb.gov.sg/seatbooking', ['geolocation']);

    // Login
    await page.goto('https://signin.nlb.gov.sg/authenticate/login', { waitUntil: 'networkidle2', timeout: 60000 });
    // Some SSO pages embed the form in an iframe in headless. Find the frame that has the fields.
    const usernameFrame = await findFrameWithSelector(page, '#username', 25000);
    await usernameFrame.waitForSelector('#username', { visible: true, timeout: 20000 });
    await usernameFrame.type('#username', process.env.NLB_USERNAME || '');
    const passwordFrame = await findFrameWithSelector(page, '#password', 25000);
    await passwordFrame.waitForSelector('#password', { visible: true, timeout: 20000 });
    await passwordFrame.type('#password', process.env.NLB_PASSWORD || '');

    const submitBtnSelector = 'input.btn[name="submit"]';
    const submitFrame = await findFrameWithSelector(page, submitBtnSelector, 25000);
    await submitFrame.waitForSelector(submitBtnSelector, { visible: true, timeout: 20000 });
    await submitFrame.click(submitBtnSelector);
    log('➜ Submitted login credentials');
    log('✅ Login successful');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
    await page.goto('https://www.nlb.gov.sg/seatbooking/mybookings', { waitUntil: 'networkidle2', timeout: 60000 });
    // Navigate directly to the booking's check-in URL
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    log('➜ Navigated to booking URL');

    // The site auto-checks in and shows a success message like:
    // "Check-in is successful for Booking ID: <...>"
    let success = false;
    try {
      // Wait up to ~10s for the message to appear
      await page.waitForSelector('text/Check-in is successful', { timeout: 15000 });
      success = true;
    } catch (_) {
      success = false;
    }

    if (success) {
      log('[NLB] Check-in is successful for Booking ID (detected message).');
    } else {
      log('[NLB] Did not detect success message within timeout.');
    }

    // Keep UI open a bit for visual confirmation, then close
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await browser.close();
    log('[NLB] Browser closed.');
  } catch (error) {
    logError('[NLB] Error during check-in by URL:', error);
  }
}

// Schedule: run every 15 minutes
// Pattern: second minute hour day month weekday
// '0 */15 * * * *' => at second 0, every 15th minute of every hour
const task = cron.schedule('0 */15 * * * *', runPuppeteerByUrl);

// Immediate first run
runPuppeteerByUrl();

