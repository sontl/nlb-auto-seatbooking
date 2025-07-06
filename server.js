const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { spawn } = require('child_process');
const { getPreferences, savePreferences } = require('./db');
const libraryData = require('./library.json');

const app = express();
const port = process.env.PORT || 3000;

// Live Reload Setup
const livereload = require('livereload');
const connectLivereload = require('connect-livereload');

const liveReloadServer = livereload.createServer();
liveReloadServer.watch([
    path.join(__dirname, 'public'),
    path.join(__dirname, '*.js')
]);

// Reload the page when changes are detected
liveReloadServer.server.once("connection", () => {
    setTimeout(() => {
        liveReloadServer.refresh("/");
    }, 100);
});

// Middleware
app.use(connectLivereload());
app.use(bodyParser.json());
app.use(express.static('public'));

// Routes
app.get('/api/libraries', (req, res) => {
    res.json(libraryData);
});

app.get('/api/preferences', async (req, res) => {
    try {
        const prefs = await getPreferences();
        res.json(prefs || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/preferences', async (req, res) => {
    try {
        const { libraryCode, areaCode } = req.body;
        const id = await savePreferences(libraryCode, areaCode);
        res.json({ id, libraryCode, areaCode });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/trigger-booking', (req, res) => {
    const bookingProcess = spawn('node', ['booking.js'], {
        env: { ...process.env, LIBRARY_CODE: req.body.libraryCode }
    });

    bookingProcess.stdout.on('data', (data) => {
        console.log(`Booking output: ${data}`);
    });

    bookingProcess.stderr.on('data', (data) => {
        console.error(`Booking error: ${data}`);
    });

    bookingProcess.on('close', (code) => {
        console.log(`Booking process exited with code ${code}`);
    });

    res.json({ message: 'Booking process started' });
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 