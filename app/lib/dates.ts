// Pure date/insight logic. No I/O, no framework imports — kept this way so
// it's cheap to unit test and easy to trust (these are the only places a bug
// would actually be costly: a wrong count or a wrong reminder).

export const ALLOWANCE_PER_YEAR = 40;

/** Parse an ISO 'YYYY-MM-DD' string as a local calendar date (no time-of-day, no timezone drift). */
export function parseISO(dateISO: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(now: Date = new Date()): string {
  return toISO(now);
}

export function addDays(dateISO: string, days: number): string {
  const d = parseISO(dateISO);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Whole days from `aISO` to `bISO` (positive if b is after a). */
export function daysBetween(aISO: string, bISO: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const a = parseISO(aISO).getTime();
  const b = parseISO(bISO).getTime();
  return Math.round((b - a) / msPerDay);
}

export function yearOf(dateISO: string): number {
  return parseISO(dateISO).getFullYear();
}

/** 0 = Sunday .. 6 = Saturday */
export function dayOfWeek(dateISO: string): number {
  return parseISO(dateISO).getDay();
}

export function isWeekend(dateISO: string): boolean {
  const dow = dayOfWeek(dateISO);
  return dow === 0 || dow === 6;
}

export function daysUntilYearEnd(todayIso: string): number {
  const year = yearOf(todayIso);
  return daysBetween(todayIso, `${year}-12-31`);
}

export interface AllowanceSummary {
  year: number;
  used: number;
  remaining: number;
  total: number;
}

/** Counts every logged day in the given year (past or future — both are committed). */
export function allowanceSummary(
  loggedDatesISO: string[],
  year: number,
  total: number = ALLOWANCE_PER_YEAR,
): AllowanceSummary {
  const used = loggedDatesISO.filter((d) => yearOf(d) === year).length;
  return { year, used, remaining: Math.max(0, total - used), total };
}

export type DayStatus = "used" | "scheduled";

export function statusOf(dateISO: string, todayIso: string): DayStatus {
  return dateISO <= todayIso ? "used" : "scheduled";
}

/**
 * A weekday is a "bridge day" when both the day before and the day after are
 * non-work days (a weekend day or a holiday) — i.e. taking it stitches two
 * non-work stretches into one, the classic BR "ponte" pattern. This also
 * naturally covers the two simplest cases: a holiday on Thursday flags
 * Friday (Thu=holiday, Sat=weekend), and a holiday on Tuesday flags Monday
 * (Sun=weekend, Tue=holiday).
 */
export function isBridgeDay(
  dateISO: string,
  holidayDatesISO: ReadonlySet<string>,
): boolean {
  if (isWeekend(dateISO)) return false;
  if (holidayDatesISO.has(dateISO)) return false; // it's a holiday itself, not a bridge

  const isNonWork = (d: string) => isWeekend(d) || holidayDatesISO.has(d);
  return isNonWork(addDays(dateISO, -1)) && isNonWork(addDays(dateISO, 1));
}

export interface BridgeDaySuggestion {
  date: string;
  adjacentHoliday: string; // name of the holiday that creates the bridge, if any
}

/**
 * Bridge days in [fromISO, fromISO + horizonDays), excluding dates already
 * logged in `excludeDatesISO`.
 */
export function upcomingBridgeDays(
  fromISO: string,
  horizonDays: number,
  holidays: ReadonlyArray<{ date: string; name: string }>,
  excludeDatesISO: ReadonlySet<string>,
): BridgeDaySuggestion[] {
  const holidayDates = new Set(holidays.map((h) => h.date));
  const holidayNameByDate = new Map(holidays.map((h) => [h.date, h.name]));
  const results: BridgeDaySuggestion[] = [];

  for (let i = 0; i < horizonDays; i++) {
    const date = addDays(fromISO, i);
    if (excludeDatesISO.has(date)) continue;
    if (!isBridgeDay(date, holidayDates)) continue;

    const before = addDays(date, -1);
    const after = addDays(date, 1);
    const adjacentHoliday =
      holidayNameByDate.get(before) ?? holidayNameByDate.get(after) ?? "";
    results.push({ date, adjacentHoliday });
  }

  return results;
}

/** The soonest scheduled (future) date within `reminderDaysBefore` days of today, or null. */
export function nextReminderDate(
  loggedDatesISO: string[],
  todayIso: string,
  reminderDaysBefore: number,
): string | null {
  const threshold = addDays(todayIso, reminderDaysBefore);
  const upcoming = loggedDatesISO
    .filter((d) => d >= todayIso && d <= threshold)
    .sort();
  return upcoming[0] ?? null;
}
