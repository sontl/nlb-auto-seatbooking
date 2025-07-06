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

module.exports = {
  getPreferences,
  savePreferences
}; 