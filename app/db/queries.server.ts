import { db } from "./client.server";

export interface User {
  id: number;
  username: string;
  password_hash: string;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
  scope: "national" | "state" | "city" | "custom";
}

export function getUserByUsername(username: string): User | undefined {
  return db
    .prepare(`SELECT * FROM users WHERE username = ?`)
    .get(username) as User | undefined;
}

export function getUserById(id: number): User | undefined {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as
    | User
    | undefined;
}

export function getAllLoggedDates(): string[] {
  const rows = db
    .prepare(`SELECT date FROM home_office_days ORDER BY date`)
    .all() as { date: string }[];
  return rows.map((r) => r.date);
}

export function addHomeOfficeDay(dateISO: string): void {
  db.prepare(`INSERT OR IGNORE INTO home_office_days (date) VALUES (?)`).run(
    dateISO,
  );
}

export function removeHomeOfficeDay(dateISO: string): void {
  db.prepare(`DELETE FROM home_office_days WHERE date = ?`).run(dateISO);
}

export function getHolidaysInRange(fromISO: string, toISO: string): Holiday[] {
  return db
    .prepare(
      `SELECT * FROM holidays WHERE date >= ? AND date <= ? ORDER BY date`,
    )
    .all(fromISO, toISO) as Holiday[];
}

export function getAllHolidays(): Holiday[] {
  return db
    .prepare(`SELECT * FROM holidays ORDER BY date`)
    .all() as Holiday[];
}

export function addCustomHoliday(
  dateISO: string,
  name: string,
  scope: "state" | "city" | "custom",
): void {
  db.prepare(
    `INSERT OR IGNORE INTO holidays (date, name, scope) VALUES (?, ?, ?)`,
  ).run(dateISO, name, scope);
}

export function removeHoliday(id: number): void {
  db.prepare(`DELETE FROM holidays WHERE id = ? AND scope != 'national'`).run(
    id,
  );
}

export function getReminderDaysBefore(): number {
  const row = db
    .prepare(`SELECT reminder_days_before FROM settings WHERE id = 1`)
    .get() as { reminder_days_before: number } | undefined;
  return row?.reminder_days_before ?? 1;
}

export function setReminderDaysBefore(days: number): void {
  db.prepare(`UPDATE settings SET reminder_days_before = ? WHERE id = 1`).run(
    days,
  );
}

export function updateUserPassword(userId: number, passwordHash: string): void {
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
    passwordHash,
    userId,
  );
}
