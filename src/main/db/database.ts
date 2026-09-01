import { app } from 'electron';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';

/**
 * Opens (and migrates) the local SQLite database in the OS app-data dir:
 *  - Windows: %APPDATA%/deepbrew
 *  - Linux:   ~/.config/deepbrew
 *
 * Everything is local-first; there is no network component to the DB.
 */

let db: Database.Database | null = null;

export function getDbPath(): string {
  return join(app.getPath('userData'), 'deepbrew.db');
}

export function getDb(): Database.Database {
  if (db) return db;

  const userData = app.getPath('userData');
  if (!existsSync(userData)) mkdirSync(userData, { recursive: true });

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      phase      TEXT    NOT NULL,          -- 'work' | 'break'
      started_at INTEGER NOT NULL,          -- epoch ms
      ended_at   INTEGER NOT NULL,          -- epoch ms
      planned_ms INTEGER NOT NULL,
      actual_ms  INTEGER NOT NULL,
      completed  INTEGER NOT NULL,          -- 0 | 1
      app_name   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_phase   ON sessions(phase);
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
