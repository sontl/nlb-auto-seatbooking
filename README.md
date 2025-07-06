# NLB Automation

An automation tool for booking seats and managing check-ins at National Library Board (NLB) Singapore libraries.

## Features

- **Automated Seat Booking**
  - Books multiple time slots for the next day
  - Configurable seat preferences and durations
  - Runs automatically at scheduled times using cron jobs
  - Currently configured for Serangoon Public Library

- **Automated Check-in**
  - Automatically checks in for your booked seats
  - Runs every 15 minutes during library operating hours (10 AM - 5:45 PM, Mon-Fri)
  - Includes geolocation spoofing for Serangoon Library

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/nlb-automation.git
   cd nlb-automation
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with your NLB credentials:
   ```
   NLB_USERNAME=your_username
   NLB_PASSWORD=your_password
   ```

## Usage

### Seat Booking

Run the booking script:
```bash
npm run book
```

The booking script will:
- Run at 12:01 PM (Singapore time) from Sunday to Thursday
- Book multiple 30-minute slots for the next day
- Target the Children's Collection area at Serangoon Public Library

### Check-in

Run the check-in script:
```bash
npm run checkin
```

The check-in script will:
- Run every 15 minutes between 10 AM and 5:45 PM on weekdays
- Automatically check in for your booked seats
- Simulate location at Serangoon Library

## Configuration

You can modify the following in the scripts:

### booking.js
- Seat preferences (`seatNumber` and `area` variables)
- Booking times (modify the `bookOneFlow` calls)
- Cron schedule (modify `cronSchedule`)

### checkin.js
- Check-in frequency (modify the cron schedule)
- Geolocation coordinates (if using at a different library)

## Notes

- The scripts use Puppeteer in non-headless mode for booking and headless mode for check-in
- Make sure to keep your NLB credentials secure and never commit them to version control
- The geolocation is set to Serangoon Library by default
