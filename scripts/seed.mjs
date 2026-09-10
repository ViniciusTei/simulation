#!/usr/bin/env node
// One-time setup script: creates the single user account and seeds national
// + SP-state holidays for this year and next. Run with:
//   node --env-file=.env scripts/seed.mjs
//
// Requires SEED_USERNAME and SEED_PASSWORD in .env (see .env.example).

import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import Holidays from "date-holidays";
import fs from "node:fs";
import path from "node:path";

const username = process.env.SEED_USERNAME;
const password = process.env.SEED_PASSWORD;
const dbPath = process.env.DB_PATH || "./data/app.db";

if (!username || !password) {
  console.error(
    "SEED_USERNAME and SEED_PASSWORD must be set (in .env or the environment).",
  );
  process.exit(1);
}

const dir = path.dirname(dbPath);
if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS home_office_days (
    id INTEGER PRIMARY KEY,
    date TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('national', 'state', 'city', 'custom')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(date, name)
  );
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    reminder_days_before INTEGER NOT NULL DEFAULT 1
  );
`);
db.prepare(
  `INSERT OR IGNORE INTO settings (id, reminder_days_before) VALUES (1, 1)`,
).run();

const passwordHash = await bcrypt.hash(password, 10);
const existing = db
  .prepare(`SELECT id FROM users WHERE username = ?`)
  .get(username);

if (existing) {
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
    passwordHash,
    existing.id,
  );
  console.log(`Updated password for existing user "${username}".`);
} else {
  db.prepare(
    `INSERT INTO users (username, password_hash) VALUES (?, ?)`,
  ).run(username, passwordHash);
  console.log(`Created user "${username}".`);
}

// Seed national + SP-state holidays for this year and next.
const thisYear = new Date().getFullYear();
const years = [thisYear, thisYear + 1];
const RELEVANT_TYPES = new Set(["public", "bank"]);
const countryOnly = new Holidays("BR");
const withState = new Holidays("BR", "SP");
const insert = db.prepare(
  `INSERT OR IGNORE INTO holidays (date, name, scope) VALUES (?, ?, ?)`,
);

let count = 0;
for (const year of years) {
  const countryDates = new Set(
    countryOnly
      .getHolidays(year)
      .filter((h) => RELEVANT_TYPES.has(h.type))
      .map((h) => `${h.date.slice(0, 10)}|${h.name}`),
  );
  for (const h of withState.getHolidays(year)) {
    if (!RELEVANT_TYPES.has(h.type)) continue;
    const date = h.date.slice(0, 10);
    const scope = countryDates.has(`${date}|${h.name}`) ? "national" : "state";
    const info = insert.run(date, h.name, scope);
    if (info.changes > 0) count++;
  }
}

console.log(`Seeded ${count} national/state holidays for ${years.join(", ")}.`);
console.log("Don't forget to add Jaguariúna city holidays via /settings.");

db.close();
