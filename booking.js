const puppeteer = require('puppeteer');
const cron = require('node-cron');

const DURATION30 = '30';
const DURATION45 = '45';

// Function to run Puppeteer
async function runPuppeteer() {
  try {
    // Launch the browser and open a new blank page
    console.log('Running Puppeteer script...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage();

    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://www.nlb.gov.sg/seatbooking', [
      'geolocation',
    ]);

    await login(page);
    await setGeolocation(page);

    await bookOneFlow(page, '11:00', DURATION30);
    await bookOneFlow(page, '11:45', DURATION30);
    await bookOneFlow(page, '13:30', DURATION30);
    await bookOneFlow(page, '14:15', DURATION30);
    await bookOneFlow(page, '15:00', DURATION30);
    await bookOneFlow(page, '15:45', DURATION30);
    await bookOneFlow(page, '16:30', DURATION30);
    await bookOneFlow(page, '17:15', DURATION30);

    // await logout(page);
    // logout button
    // const logoutButton = page.waitForSelector('button.mdi-login-variant');
    // if (logoutButton) {
    //   await logoutButton.click();
    //   console.log('Clicked to Logout');
    // } else {
    //   console.log('Logout button not found');
    // }

    // await browser.close();
  } catch (error) {
    console.error(error);
  }
}

async function bookOneFlow(page, time, duration) {
  // Go to My Booking page
  await page.goto('https://www.nlb.gov.sg/seatbooking/');

  await selectLibrary(page);
  await selectDate(page);
  await selectTime(page, time);
  await selectDuration(page, duration);
  await checkAvailableSlot(page);
  await loginToBook(page);
  await bookSeat(page);
}

async function login(page) {
  // Navigate the page to a URL
  await page.goto('https://signin.nlb.gov.sg/authenticate/login');

  // Set screen size
  // await page.setViewport({ width: 1080, height: 1024 });

  // Type into username and password fields
  await page.type('#username', process.env.NLB_USERNAME);
  await page.type('#password', process.env.NLB_PASSWORD);

  // Click on Submit button
  const submitBtnSelector = 'input.btn[name="submit"]';
  await page.waitForSelector(submitBtnSelector);
  await page.click(submitBtnSelector);

  // Wait for next page load
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

async function setGeolocation(page) {
  // Set geolocation to NLB at Serangoon Nex
  await page.setGeolocation({
    latitude: 1.3500680243819974,
    longitude: 103.87314643603517,
  });

  console.log('Set geolocation to NLB at Serangoon Nex');
}

async function selectLibrary(page) {
  // Wait for the input element to be available
  await page.waitForSelector('input[aria-label="Select library"]');

  console.log('Waited for the Select library to be available');

  // Click the input element to open the dialog
  await page.waitForSelector(
    'div.v-input > div.v-input__control > div.v-input__slot > div.v-text-field__slot > input[aria-label="Select library"]'
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));
  // Click the parent element of the input with aria-label="Select library"
  await page.click(
    'div.v-input > div.v-input__control > div.v-input__slot > div.v-text-field__slot > input[aria-label="Select library"]'
  );

  console.log('Clicked to Select library ');
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await page.click(
    'div.v-input > div.v-input__control > div.v-input__slot > div.v-text-field__slot > input[aria-label="Select library"]',
    { clickCount: 2 }
  );

  console.log('Clicked again to Select library ');
  // Wait for the dialog to be visible
  await page.waitForSelector('div[role="dialog"]');
  // Find the radio input element with the value "SRPL" (Serangoon Public Library)
  const serangoonRadioInput = await page.$('input[value="SRPL"]');
  // Click the radio input to select "Serangoon"
  await serangoonRadioInput.click();
  // Wait for some time to see the result (optional)
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function selectDate(page) {
  await page.click(
    'div.v-input > div.v-input__control > div.v-input__slot > div.v-text-field__slot > input[aria-label="Select date"]'
  );
  console.log('Clicked to Date slot ');
  await new Promise((resolve) => setTimeout(resolve, 500));

  const links = await page.$$('button > div.v-btn__content');
  console.log(links.length);
  for (var i = 0; i < links.length; i++) {
    let valueHandle = await links[i].getProperty('innerText');
    let linkText = await valueHandle.jsonValue();
    if (linkText === getTomorrowsDate().toString()) {
      await links[i].click();
      break;
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function selectTime(page, time) {
  await page.click(
    'div.v-input > div.v-input__control > div.v-input__slot > div.v-text-field__slot > input[aria-label="Select time"]'
  );
  console.log('Clicked to Time slot ');
  await new Promise((resolve) => setTimeout(resolve, 1000));
  // Find the radio input element with value "10:30"
  const radioTimeInput = await page.waitForSelector(`input[value="${time}"]`);
  // Click the radio input to select the time "10:30"
  await radioTimeInput.click();
  // Wait for some time to see the result (optional)
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function selectDuration(page, duration) {
  if (duration !== DURATION30) {
    await page.click(
      'div.v-input > div.v-input__control > div.v-input__slot > div.v-text-field__slot > input[aria-label="Select duration"]'
    );
    console.log('Clicked to Duration slot ');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Find the radio input element with value "10:30"
    const radioDurationInput = await page.waitForSelector(
      `input[value="${duration}"]`
    );
    // Click the radio input to select the time "10:30"
    await radioDurationInput.click();
    // Wait for some time to see the result (optional)
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function checkAvailableSlot(page) {
  // Wait for the button element to be visible and available
  const button = await page.waitForSelector(
    'div.row > div.col >  button > span.v-btn__content > i.mdi-magnify'
  );
  if (button) {
    await button.click();
    console.log('Clicked to Check available slots ');
  } else {
    console.log('Button not found');
  }

  // Wait for some time to see the result (optional)
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

async function loginToBook(page) {
  try {
    await page.click('div[tabindex="0"]');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const isLoginToBookButtonExist = await page.$eval(
      'div.row > div.col >  button > span.v-btn__content > i.mdi-login-variant',
      (element) => !!element
    );

    if (isLoginToBookButtonExist) {
      const loginToBookButton = await page.waitForSelector(
        'div.row > div.col >  button > span.v-btn__content > i.mdi-login-variant'
      );
      await loginToBookButton.click();
      console.log('Clicked to Login to Book button ');
    } else {
      console.log('Login to Book Button not found');
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (error) {
    console.log(error);
  }
}

async function bookSeat(page) {
  const bookButton = await page.waitForSelector(
    'div.row > div.col >  button > span.v-btn__content > i.mdi-calendar-check'
  );
  if (bookButton) {
    await bookButton.click();
    console.log('Clicked to Book button ');
  } else {
    console.log('Book Button not found');
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
  await page.click('div > i.mdi-seat-passenger');
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const radioSeatInput = await page.waitForSelector(
    'input[value="SRPL.4.EnglishGeneralCollection.1"]'
  );
  await radioSeatInput.click();

  await new Promise((resolve) => setTimeout(resolve, 1000));
  await page.click('text=Confirm');
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

function getTomorrowsDate() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowDate = tomorrow.getDate();
  console.log(`Tomorrow's date: ${tomorrowDate}`);
  return tomorrowDate;
}

// Define the cron schedule
const cronSchedule = '1 10 * * 0-4'; // 10:01 AM, Sunday through Thursday

// Schedule the task
const task = cron.schedule(cronSchedule, runPuppeteer, {
  scheduled: true,
  timezone: 'Asia/Singapore', // Set the timezone to Singapore
});

// Start the cron job
task.start();
runPuppeteer();
