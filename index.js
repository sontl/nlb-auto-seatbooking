const puppeteer = require('puppeteer');
const cron = require('node-cron');

// Function to run Puppeteer
async function runPuppeteer() {
  try {
    // Launch the browser and open a new blank page
    console.log('Running Puppeteer script...');
    const browser = await puppeteer.launch({ headless: false });

    const page = await browser.newPage();

    const context = browser.defaultBrowserContext();
    await context.overridePermissions(
      'https://www.nlb.gov.sg/seatbooking/mybookings',
      ['geolocation']
    );

    // Navigate the page to a URL
    await page.goto('https://signin.nlb.gov.sg/authenticate/login');

    // Set screen size
    await page.setViewport({ width: 1080, height: 1024 });

    // Type into username and password fields
    await page.type('#username', process.env.NLB_USERNAME);
    await page.type('#password', process.env.NLB_PASSWORD);

    // Click on Submit button
    const submitBtnSelector = 'input.btn[name="submit"]';
    await page.waitForSelector(submitBtnSelector);
    await page.click(submitBtnSelector);

    // Wait for next page load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Go to My Booking page
    await page.goto('https://www.nlb.gov.sg/seatbooking/mybookings');

    // Locate the full title with a unique string
    const textSelector = await page.waitForSelector('text/Today');
    const fullTitle = await textSelector?.evaluate((el) => el.textContent);
    await page.setGeolocation({
      latitude: 1.3500680243819974,
      longitude: 103.87314643603517,
    });

    console.log(fullTitle);
    // Wait for 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await new Promise((resolve) => setTimeout(resolve, 2000));
    await browser.close();
  } catch (error) {
    console.error(error);
  }
}

// Schedule the Puppeteer script to run every minute
task = cron.schedule('0 */30 * * * *', runPuppeteer);

// To stop the cron task later
// task.stop();
