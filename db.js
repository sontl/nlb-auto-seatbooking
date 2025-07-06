const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'preferences.db'));

// Initialize database
db.serialize(() => {
  // Create preferences table
  db.run(`CREATE TABLE IF NOT EXISTS preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    library_code TEXT NOT NULL,
    area_code TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create schedules table
  db.run(`CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    library_code TEXT NOT NULL,
    area_code TEXT NOT NULL,
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Get current preferences
function getPreferences() {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM preferences ORDER BY created_at DESC LIMIT 1", (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
}

// Save new preferences
function savePreferences(libraryCode, areaCode) {
  return new Promise((resolve, reject) => {
    db.run("INSERT INTO preferences (library_code, area_code) VALUES (?, ?)", 
      [libraryCode, areaCode], 
      function(err) {
        if (err) reject(err);
        resolve(this.lastID);
      });
  });
}

// Schedule Management Functions
function getAllSchedules() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM schedules ORDER BY scheduled_date ASC, scheduled_time ASC", (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  });
}

function getActiveSchedules() {
  const now = new Date().toISOString().split('T')[0];
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM schedules WHERE scheduled_date >= ? AND status = 'pending' ORDER BY scheduled_date ASC, scheduled_time ASC",
      [now],
      (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      }
    );
  });
}

function addSchedule(libraryCode, areaCode, scheduledDate, scheduledTime) {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO schedules (library_code, area_code, scheduled_date, scheduled_time) VALUES (?, ?, ?, ?)",
      [libraryCode, areaCode, scheduledDate, scheduledTime],
      function(err) {
        if (err) reject(err);
        resolve(this.lastID);
      }
    );
  });
}

function updateScheduleStatus(id, status) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE schedules SET status = ? WHERE id = ?",
      [status, id],
      function(err) {
        if (err) reject(err);
        resolve(this.changes);
      }
    );
  });
}

function deleteSchedule(id) {
  return new Promise((resolve, reject) => {
    db.run(
      "DELETE FROM schedules WHERE id = ?",
      [id],
      function(err) {
        if (err) reject(err);
        resolve(this.changes);
      }
    );
  });
}

module.exports = {
  getPreferences,
  savePreferences,
  getAllSchedules,
  getActiveSchedules,
  addSchedule,
  updateScheduleStatus,
  deleteSchedule
}; 