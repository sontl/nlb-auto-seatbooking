const cron = require('node-cron');
const { runPuppeteerWithPreferences } = require('./booking');
const db = require('./db');

// Schedule tasks for each configured booking
async function scheduleBookings() {
    console.log('\n📋 Loading active schedules from database...');
    try {
        const schedules = await db.getActiveSchedules();
        console.log(`📊 Found ${schedules.length} active schedule(s)`);
        
        schedules.forEach((schedule, index) => {
            console.log(`\n🔍 Processing schedule ${index + 1}/${schedules.length}:`);
            console.log(`   ID: ${schedule.id}`);
            
            const [hour, minute] = schedule.scheduled_time.split(':');
            const scheduledDate = new Date(schedule.scheduled_date);
            // Set the hour and minute components
            scheduledDate.setHours(parseInt(hour), parseInt(minute), 0, 0);
            const now = new Date();
            
            // Only schedule if the datetime is in the future
            if (scheduledDate > now) {
                const cronExpression = `${minute} ${hour} ${scheduledDate.getDate()} ${scheduledDate.getMonth() + 1} *`;
                console.log(`   🕐 Cron Expression: ${cronExpression}`);
                
                cron.schedule(cronExpression, async () => {
                    const startTime = new Date();
                    console.log(`\n🎯 Executing scheduled booking #${schedule.id}`);
                    console.log(`   📅 Date: ${schedule.scheduled_date}`);
                    console.log(`   ⏰ Time: ${schedule.scheduled_time}`);
                    console.log(`   📚 Library: ${schedule.library_code}`);
                    console.log(`   🏢 Area: ${schedule.area_code}`);
                    
                    try {
                        console.log('\n⚡ Starting Puppeteer booking process...');
                        await runPuppeteerWithPreferences({
                            libraryCode: schedule.library_code,
                            areaCode: schedule.area_code
                        });
                        const endTime = new Date();
                        const duration = (endTime - startTime) / 1000;
                        
                        console.log(`\n✅ Booking successful!`);
                        console.log(`   ⏱️  Duration: ${duration.toFixed(2)} seconds`);
                        
                        // Update schedule status to completed
                        await db.updateScheduleStatus(schedule.id, 'completed');
                        console.log(`   📝 Schedule status updated to: completed`);
                    } catch (error) {
                        const endTime = new Date();
                        const duration = (endTime - startTime) / 1000;
                        
                        console.error('\n❌ Booking failed!');
                        console.error(`   ⏱️  Duration: ${duration.toFixed(2)} seconds`);
                        console.error(`   💥 Error: ${error.message}`);
                        if (error.stack) {
                            console.error(`   📚 Stack trace: ${error.stack}`);
                        }
                        
                        // Update schedule status to failed
                        await db.updateScheduleStatus(schedule.id, 'failed');
                        console.log(`   📝 Schedule status updated to: failed`);
                    }
                }, {
                    timezone: 'Asia/Singapore'
                });
                
                console.log(`✅ Successfully scheduled booking #${schedule.id}`);
                console.log(`   📅 Execution date: ${schedule.scheduled_date}`);
                console.log(`   ⏰ Execution time: ${schedule.scheduled_time}`);
            } else {
                console.log(`⏭️  Skipping past schedule #${schedule.id} (${schedule.scheduled_date} ${schedule.scheduled_time})`);
            }
        });
    } catch (error) {
        console.error('\n❌ Error loading schedules:');
        console.error(`   💥 Message: ${error.message}`);
        if (error.stack) {
            console.error(`   📚 Stack trace: ${error.stack}`);
        }
    }
}

// Start the scheduler
console.log('\n🚀 Starting NLB Booking Scheduler...');
console.log(`📅 Current time: ${new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`);
scheduleBookings();

// Refresh schedules every minute for development testing
cron.schedule('*/1 * * * *', () => {
    console.log('\n🔄 Minute schedule refresh triggered');
    console.log(`📅 Current time: ${new Date().toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`);
    scheduleBookings();
}, {
    timezone: 'Asia/Singapore'
}); 