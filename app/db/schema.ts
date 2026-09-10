// SQLite schema for the home office tracker.
// Applied idempotently on every server start via `CREATE TABLE IF NOT EXISTS`.

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A row = one home office day. Whether it reads as "used" or "scheduled" is
-- derived at query time by comparing the date column to today, not stored here.
CREATE TABLE IF NOT EXISTS home_office_days (
  id INTEGER PRIMARY KEY,
  date TEXT UNIQUE NOT NULL, -- ISO 'YYYY-MM-DD'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL, -- ISO 'YYYY-MM-DD'
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('national', 'state', 'city', 'custom')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, name)
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  reminder_days_before INTEGER NOT NULL DEFAULT 1
);
`;
