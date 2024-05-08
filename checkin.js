const puppeteer = require('puppeteer');
const cron = require('node-cron');

// Function to run Puppeteer
async function runPuppeteer() {
  try {
    // Launch the browser and open a new blank page
    console.log(`Running NLB Automation Checkin at ...${printCurrentTime()}`);
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
    });

    const page = await browser.newPage();

    const context = browser.defaultBrowserContext();

    const bookingUrl = 'https://www.nlb.gov.sg/seatbooking/mybookings';
    await context.overridePermissions(bookingUrl, ['geolocation']);

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
    await page.goto(bookingUrl);

    await page.setGeolocation({
      latitude: 1.3500680243819974,
      longitude: 103.87314643603517,
    });

    // Wait for 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await page.evaluateOnNewDocument(() => {
      navigator.geolocation.getCurrentPosition = (cb) => {
        setTimeout(() => {
          cb({
            coords: {
              accuracy: 21,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              latitude: 1.3500680243819974,
              longitude: 103.87314643603517,
              speed: null,
            },
          });
        }, 1000);
      };
    });
    // if checkin is successful, there will be notification on the top with text Check-in is successful
    try {
      await new Promise((resolve) => setTimeout(resolve, 15000));
      const textSelector = await page.waitForSelector(
        'text/Check-in is successful'
      );
      const status = await textSelector?.evaluate((el) => el.textContent);

      if (status) {
        console.log('Checkedin!');
      } else {
        console.log('Failed to checkin!');
      }
    } catch (error) {
      console.log('Failed to checkin!');
    }
    await browser.close();
  } catch (error) {
    console.error(error);
  }
}

// Schedule the Puppeteer script to run every
// 15 minutes from Monday to Friday, between 10am and 5:45pm
//task = cron.schedule('0 */30 * * * *', runPuppeteer);
task = cron.schedule('0 */15 10-17 * * 1-5', runPuppeteer);

runPuppeteer();

// To stop the cron task later
// task.stop();
function printCurrentTime() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are zero-based
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const formattedTime = `${day}-${month}-${year} ${hours}:${minutes}`;
  // console.log(formattedTime);
  return formattedTime;
}
