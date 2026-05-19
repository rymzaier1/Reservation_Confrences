const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(
  path.join(__dirname, 'reservations.sqlite'),
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error('Erreur connexion SQLite Réservations:', err.message);
    } else {
      console.log('Microservice Réservations : connecté à SQLite.');
      db.run(`
        CREATE TABLE IF NOT EXISTS reservations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          ressource TEXT NOT NULL,
          date_debut TEXT NOT NULL,
          date_fin TEXT NOT NULL,
          statut TEXT DEFAULT 'en_attente',
          notes TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now'))
        )
      `, (err) => {
        if (err) {
          console.error('Erreur création table:', err.message);
        } else {
          console.log('Table reservations prête.');
        }
      });
    }
  }
);

module.exports = db;