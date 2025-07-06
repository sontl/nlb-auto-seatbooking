const puppeteer = require('puppeteer');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const DURATION30 = '30';
const DURATION45 = '45';

// Load library data from JSON file
const libraryData = JSON.parse(fs.readFileSync(path.join(__dirname, 'library.json'), 'utf8'));

// Convert library data into a more usable format
const LIBRARIES = libraryData.reduce((acc, lib) => {
  if (lib.geolocationInfo && lib.geolocationInfo.length > 0) {
    const geo = lib.geolocationInfo[0];
    acc[lib.code] = {
      code: lib.code,
      name: lib.name,
      location: {
        latitude: (geo.maxLat + geo.minLat) / 2, // Use center point
        longitude: (geo.maxLong + geo.minLong) / 2
      }
    };
  }
  return acc;
}, {});

// Get library code from environment variable or default to Serangoon
const LIBRARY_CODE = process.env.LIBRARY_CODE || 'SRPL';
const SELECTED_LIBRARY = LIBRARIES[LIBRARY_CODE];

if (!SELECTED_LIBRARY) {
  throw new Error(`Invalid library code: ${LIBRARY_CODE}. Available libraries: ${Object.keys(LIBRARIES).join(', ')}`);
}

// Function to run Puppeteer
async function runPuppeteer() {
  try {
    console.log(`Running Puppeteer script for ${SELECTED_LIBRARY.name}...`);
    const browser = await puppeteer.launch({
      headless: false,
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
  const seatNumber = 'SRPL.4.ChildrenCollection.13';
  const area = 'SRPL.4.ChildrenCollection';
  // Go to My Booking page
  await page.goto('https://www.nlb.gov.sg/seatbooking/');
  // Wait for the page to load
  await page.waitForSelector('input[aria-label="Select library"]', { visible: true, timeout: 30000 });
  console.log('Seat booking Page loaded');
  await selectLibrary(page);
  await selectArea(page, area);
  await selectDate(page);
  await selectTime(page, time);
  await selectDuration(page, duration);
  await checkAvailableSlot(page);
  await loginToBook(page);
  await bookSeat(page, seatNumber);
}

async function login(page) {
  // Navigate the page to a URL
  await page.goto('https://signin.nlb.gov.sg/authenticate/login');

  // Type into username and password fields
  await page.type('#username', process.env.NLB_USERNAME);
  await page.type('#password', process.env.NLB_PASSWORD);

  // Click on Submit button
  const submitBtnSelector = 'input.btn[name="submit"]';
  await page.waitForSelector(submitBtnSelector);
  await page.click(submitBtnSelector);
  console.log('Clicked on Submit button');
  // Wait for navigation to complete after login
  console.log('Navigation to complete after login');
}

async function setGeolocation(page) {
  // Set geolocation based on selected library
  await page.setGeolocation({
    latitude: SELECTED_LIBRARY.location.latitude,
    longitude: SELECTED_LIBRARY.location.longitude,
  });

  console.log(`Set geolocation to ${SELECTED_LIBRARY.name}`);
}

async function selectLibrary(page) {
  try {
    const libraryInputSelector = 'input[aria-label="Select library"]';
    const dialogSelector = 'div[role="dialog"]';
    const librarySelector = `input[value="${SELECTED_LIBRARY.code}"]`;
    let maxAttempts = 3;
    let attempt = 0;
    let dialogVisible = false;

    console.log(`Waiting for the library input to be available to select ${SELECTED_LIBRARY.name}`);    
    
    await page.waitForSelector(libraryInputSelector, { visible: true, timeout: 30000 });
    console.log('Library selector is available and ready');

    while (attempt < maxAttempts && !dialogVisible) {
      attempt++;
      console.log(`Attempt ${attempt} to open library selection dialog`);

      await page.click(libraryInputSelector, { clickCount: 1 });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      dialogVisible = await page.evaluate((selector) => {
        const dialog = document.querySelector(selector);
        return dialog && 
               window.getComputedStyle(dialog).display !== 'none' && 
               window.getComputedStyle(dialog).visibility !== 'hidden';
      }, dialogSelector);

      if (!dialogVisible) {
        console.log('Dialog not visible, trying again...');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!dialogVisible) {
      throw new Error('Failed to open library selection dialog after multiple attempts');
    }

    console.log('Library selection dialog opened successfully');

    await page.waitForSelector(librarySelector, { visible: true, timeout: 30000 });
    await page.click(librarySelector);
    
    const selectedValue = await page.$eval(libraryInputSelector, el => el.value);
    // add logs
    console.log(`Selected value: ${selectedValue}`);
    console.log("SELECTED_LIBRARY code: ", SELECTED_LIBRARY.name);
    if (!selectedValue.includes(SELECTED_LIBRARY.name)) {
      throw new Error('Library selection verification failed');
    }
    
    console.log(`Successfully selected ${SELECTED_LIBRARY.name}`);
  } catch (error) {
    console.error('Error in selectLibrary:', error.message);
    throw error;
  }
}

async function selectArea(page, area) {
  await page.click(
    'div.v-input > div.v-input__control > div.v-input__slot > div.cv-text-field__slot > input[aria-label="Select area"]'
  );
  console.log('Clicked to Area slot ');
  await new Promise((resolve) => setTimeout(resolve, 500));

  await page.waitForSelector('div[role="dialog"]');
  const nearChineseChildrenCollectionRadioInput = await page.$(
    `input[value='${area}']`
  );
  await nearChineseChildrenCollectionRadioInput.click();
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
      console.log('Date selected: ' + linkText);
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
    //await page.click('div[tabindex="0"]');
    //await new Promise((resolve) => setTimeout(resolve, 2000));

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

async function bookSeat(page, seatNumber) {
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
    `input[value="${seatNumber}"]`
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
  //console.log(`Tomorrow's date: ${tomorrowDate}`);
  return tomorrowDate;
}

// Define the cron schedule
const cronSchedule = '1 12 * * 0-4'; // 10:01 AM, Sunday through Thursday

// Schedule the task
const task = cron.schedule(cronSchedule, runPuppeteer, {
  scheduled: true,
  timezone: 'Asia/Singapore', // Set the timezone to Singapore
});

// Start the cron job
task.start();
runPuppeteer();
