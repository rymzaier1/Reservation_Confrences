const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(
  path.join(__dirname, 'users.sqlite'),
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error('Erreur connexion SQLite:', err.message);
    } else {
      console.log('Microservice Users : connecté à SQLite.');
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          nom TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          telephone TEXT,
          password TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `, (err) => {
        if (err) {
          console.error('Erreur création table:', err.message);
        } else {
          console.log('Table users prête.');
        }
      });
    }
  }
);

module.exports = db;