import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";
import { env } from "~/lib/env.server";

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

function createConnection(): Database.Database {
  const dbPath = env.dbPath;
  const dir = path.dirname(dbPath);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  db.prepare(
    `INSERT OR IGNORE INTO settings (id, reminder_days_before) VALUES (1, 1)`,
  ).run();
  return db;
}

// Vite's dev server re-evaluates modules on change; cache the connection on
// `global` so we don't reopen the SQLite file on every HMR update.
export const db = global.__db ?? createConnection();
if (process.env.NODE_ENV !== "production") global.__db = db;
