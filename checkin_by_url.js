const puppeteer = require('puppeteer');
const cron = require('node-cron');

// Usage:
// 1) Set env vars NLB_USERNAME and NLB_PASSWORD
// 2) Provide booking number via env NLB_BOOKING_NUMBER or CLI arg: node checkin_by_url.js 792
//    This will open https://www.nlb.gov.sg/seatbooking/?loc=NLB.LKCRL11.11.BookingAreaZoneD1.<NUMBER>
// 3) Script waits ~10 seconds for auto check-in UI then closes the browser

async function runPuppeteerByUrl() {
  const bookingNumber = process.env.NLB_BOOKING_NUMBER || process.argv[2] || '792';
  const targetUrl = `https://www.nlb.gov.sg/seatbooking/?loc=NLB.LKCRL11.11.BookingAreaZoneD1.${bookingNumber}`;

  try {
    console.log(`[NLB] Check-in by URL starting... number=${bookingNumber}`);
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1024 });

    // Always allow geolocation for NLB to avoid the permission prompt
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://www.nlb.gov.sg', ['geolocation']);
    await context.overridePermissions('https://www.nlb.gov.sg/seatbooking', ['geolocation']);

    // Login
    await page.goto('https://signin.nlb.gov.sg/authenticate/login');
    await page.type('#username', process.env.NLB_USERNAME || '');
    await page.type('#password', process.env.NLB_PASSWORD || '');

    const submitBtnSelector = 'input.btn[name="submit"]';
    await page.waitForSelector(submitBtnSelector, { timeout: 15000 });
    await page.click(submitBtnSelector);
    console.log('➜ Submitted login credentials');
    console.log('✅ Login successful');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log('➜ Waited for 3 seconds');
    await page.goto('https://www.nlb.gov.sg/seatbooking/mybookings')
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log('➜ Waited for 3 seconds');
    // Navigate directly to the booking's check-in URL
    await page.goto(targetUrl);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log('➜ Navigated to booking URL');

    // The site auto-checks in and shows a success message like:
    // "Check-in is successful for Booking ID: <...>"
    let success = false;
    try {
      // Wait up to ~10s for the message to appear
      await page.waitForSelector('text/Check-in is successful', { timeout: 10000 });
      success = true;
    } catch (_) {
      success = false;
    }

    if (success) {
      console.log('[NLB] Check-in is successful for Booking ID (detected message).');
    } else {
      console.log('[NLB] Did not detect success message within timeout.');
    }

    // Keep UI open a bit for visual confirmation, then close
    await new Promise((resolve) => setTimeout(resolve, 10000));
    await browser.close();
    console.log('[NLB] Browser closed.');
  } catch (error) {
    console.error('[NLB] Error during check-in by URL:', error);
  }
}

// Schedule: run every 15 minutes
// Pattern: second minute hour day month weekday
// '0 */15 * * * *' => at second 0, every 15th minute of every hour
const task = cron.schedule('0 */15 * * * *', runPuppeteerByUrl);

// Immediate first run
runPuppeteerByUrl();
