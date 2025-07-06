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
      areas: lib.areas,
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
    console.log('\n🎯 Starting booking session for ' + SELECTED_LIBRARY.name + ' library...\n');
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
    console.error('❌ Error:', error);
  }
}

async function bookOneFlow(page, time, duration) {
  // Get the first available area for the selected library
  const selectedLibraryAreas = SELECTED_LIBRARY.areas;
  if (!selectedLibraryAreas || selectedLibraryAreas.length === 0) {
    throw new Error(`No areas available for library: ${SELECTED_LIBRARY.name}`);
  }
  
  // Use the first area's code and first seat code
  const firstArea = selectedLibraryAreas[0];
  const areaCode = firstArea.code;
  const seatNumber = firstArea.firstSeatCode;
  
  console.log('\n📚 Starting new booking flow for ' + time + ' (' + duration + ' mins)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  await page.goto('https://www.nlb.gov.sg/seatbooking/');
  await page.waitForSelector('input[aria-label="Select library"]', { visible: true, timeout: 30000 });
  console.log('✨ Seat booking page loaded successfully');
  
  await selectLibrary(page);
  await selectArea(page, areaCode);
  await selectDate(page);
  await selectTime(page, time);
  await selectDuration(page, duration);
  await checkAvailableSlot(page);
  await loginToBook(page);
  await bookSeat(page, seatNumber);
  
  console.log('\n✅ Booking flow completed for ' + time);
}

async function login(page) {
  console.log('\n🔐 Starting login process...');
  await page.goto('https://signin.nlb.gov.sg/authenticate/login');

  await page.type('#username', process.env.NLB_USERNAME);
  await page.type('#password', process.env.NLB_PASSWORD);

  const submitBtnSelector = 'input.btn[name="submit"]';
  await page.waitForSelector(submitBtnSelector);
  await page.click(submitBtnSelector);
  console.log('➜ Submitted login credentials');
  console.log('✅ Login successful');
}

async function setGeolocation(page) {
  await page.setGeolocation({
    latitude: SELECTED_LIBRARY.location.latitude,
    longitude: SELECTED_LIBRARY.location.longitude,
  });

  console.log('\n📍 Location set to: ' + SELECTED_LIBRARY.name);
}

async function selectLibrary(page) {
  try {
    const libraryInputSelector = 'input[aria-label="Select library"]';
    const dialogSelector = 'div[role="dialog"]';
    const librarySelector = `input[value="${SELECTED_LIBRARY.code}"]`;
    let maxAttempts = 3;
    let attempt = 0;
    let dialogVisible = false;

    console.log('\n📚 Selecting library: ' + SELECTED_LIBRARY.name);    
    
    await page.waitForSelector(libraryInputSelector, { visible: true, timeout: 30000 });
    console.log('➜ Library selector ready');

    while (attempt < maxAttempts && !dialogVisible) {
      attempt++;
      console.log(`  Attempt ${attempt} to open selection dialog...`);

      await page.click(libraryInputSelector, { clickCount: 1 });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      dialogVisible = await page.evaluate((selector) => {
        const dialog = document.querySelector(selector);
        return dialog && 
               window.getComputedStyle(dialog).display !== 'none' && 
               window.getComputedStyle(dialog).visibility !== 'hidden';
      }, dialogSelector);

      if (!dialogVisible) {
        console.log('  ↳ Dialog not visible, retrying...');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!dialogVisible) {
      throw new Error('Failed to open library selection dialog after multiple attempts');
    }

    console.log('➜ Selection dialog opened');

    await page.waitForSelector(librarySelector, { visible: true, timeout: 30000 });
    await page.click(librarySelector);
    
    const selectedValue = await page.$eval(libraryInputSelector, el => el.value);
    if (!selectedValue.includes(SELECTED_LIBRARY.name)) {
      throw new Error('Library selection verification failed');
    }
    
    console.log('✅ Selected: ' + SELECTED_LIBRARY.name);
  } catch (error) {
    console.error('❌ Error selecting library:', error.message);
    throw error;
  }
}

async function selectArea(page, area) {
  console.log('\n📍 Selecting area: ' + area);
  
  // Wait for the area input to be visible
  const areaInputSelector = 'input[aria-label="Select area"]';
  await page.waitForSelector(areaInputSelector, { visible: true, timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  // Click the area input to open the dialog
  await page.click(areaInputSelector);
  console.log('➜ Area selector opened');
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Wait for and click the area option
  await page.waitForSelector('div[role="dialog"]');
  const areaOptionSelector = `input[value='${area}']`;
  await page.waitForSelector(areaOptionSelector, { visible: true, timeout: 30000 });
  await page.click(areaOptionSelector);
  
  console.log('✅ Area selected');
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function selectDate(page) {
  console.log('\n📅 Selecting date...');
  await page.click(
    'div.v-input > div.v-input__control > div.v-input__slot > div.v-text-field__slot > input[aria-label="Select date"]'
  );
  console.log('➜ Date selector opened');
  await new Promise((resolve) => setTimeout(resolve, 500));

  const links = await page.$$('button > div.v-btn__content');
  for (var i = 0; i < links.length; i++) {
    let valueHandle = await links[i].getProperty('innerText');
    let linkText = await valueHandle.jsonValue();
    if (linkText === getTomorrowsDate().toString()) {
      console.log('✅ Selected date: ' + linkText);
      await links[i].click();
      break;
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function selectTime(page, time) {
  console.log('\n⏰ Selecting time slot: ' + time);
  await page.click(
    'div.v-input > div.v-input__control > div.v-input__slot > div.v-text-field__slot > input[aria-label="Select time"]'
  );
  console.log('➜ Time selector opened');
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  const radioTimeInput = await page.waitForSelector(`input[value="${time}"]`);
  await radioTimeInput.click();
  console.log('✅ Time selected');
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function selectDuration(page, duration) {
  if (duration !== DURATION30) {
    console.log('\n⏱️ Selecting duration: ' + duration + ' minutes');
    await page.click(
      'div.v-input > div.v-input__control > div.v-input__slot > div.v-text-field__slot > input[aria-label="Select duration"]'
    );
    console.log('➜ Duration selector opened');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const radioDurationInput = await page.waitForSelector(
      `input[value="${duration}"]`
    );
    await radioDurationInput.click();
    console.log('✅ Duration selected');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function checkAvailableSlot(page) {
  console.log('\n🔍 Checking available slots...');
  const button = await page.waitForSelector(
    'div.row > div.col >  button > span.v-btn__content > i.mdi-magnify'
  );
  if (button) {
    await button.click();
    console.log('➜ Searching for available slots');
  } else {
    console.log('❌ Search button not found');
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log('✅ Slot check completed');
}

async function loginToBook(page) {
  try {
    console.log('\n🔐 Proceeding to booking authentication...');

    const isLoginToBookButtonExist = await page.$eval(
      'div.row > div.col >  button > span.v-btn__content > i.mdi-login-variant',
      (element) => !!element
    );

    if (isLoginToBookButtonExist) {
      const loginToBookButton = await page.waitForSelector(
        'div.row > div.col >  button > span.v-btn__content > i.mdi-login-variant'
      );
      await loginToBookButton.click();
      console.log('➜ Authenticating for booking');
    } else {
      console.log('ℹ️ Already authenticated');
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (error) {
    console.error('❌ Authentication error:', error);
  }
}

async function bookSeat(page, seatNumber) {
  console.log('\n💺 Selecting and confirming seat...');
  const bookButton = await page.waitForSelector(
    'div.row > div.col >  button > span.v-btn__content > i.mdi-calendar-check'
  );
  if (bookButton) {
    await bookButton.click();
    console.log('➜ Booking process initiated');
  } else {
    console.log('❌ Book button not found');
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
  await page.click('div > i.mdi-seat-passenger');
  console.log('➜ Selecting seat: ' + seatNumber);
  
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const radioSeatInput = await page.waitForSelector(
    `input[value="${seatNumber}"]`
  );
  await radioSeatInput.click();

  await new Promise((resolve) => setTimeout(resolve, 1000));
  await page.click('text=Confirm');
  console.log('✅ Seat booking confirmed!');
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
