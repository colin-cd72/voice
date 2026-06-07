import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

let db;

export function initDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'audio'), { recursive: true });
  const dbPath = path.join(dataDir, 'voices.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = `
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      default_script TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shortlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      voice_id TEXT NOT NULL,
      voice_name TEXT NOT NULL,
      voice_source TEXT NOT NULL,
      voice_meta TEXT,
      note TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      added_at INTEGER NOT NULL,
      UNIQUE(project_id, voice_id)
    );

    CREATE TABLE IF NOT EXISTS generations (
      cache_key TEXT PRIMARY KEY,
      voice_id TEXT NOT NULL,
      script TEXT NOT NULL,
      model TEXT NOT NULL,
      audio_path TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `;
  db.exec(schema);

  return db;
}

export function getDb() {
  if (!db) throw new Error('DB not initialized');
  return db;
}
