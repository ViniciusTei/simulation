import Holidays from "date-holidays";
import { db } from "~/db/client.server";

const RELEVANT_TYPES = new Set(["public", "bank"]);

/**
 * Seeds national (BR) and São Paulo state holidays for the given years.
 * Uses `date-holidays`, so it needs no manual upkeep and covers any year.
 * Idempotent: relies on the (date, name) UNIQUE constraint on `holidays`.
 *
 * Municipal (Jaguariúna) holidays aren't covered by any reliable library and
 * are entered by hand on the Settings page as scope='city'.
 */
export function seedHolidaysForYears(years: number[]): void {
  const countryOnly = new Holidays("BR");
  const withState = new Holidays("BR", "SP");

  const insert = db.prepare(
    `INSERT OR IGNORE INTO holidays (date, name, scope) VALUES (?, ?, ?)`,
  );

  const insertMany = db.transaction((years: number[]) => {
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
        const scope = countryDates.has(`${date}|${h.name}`)
          ? "national"
          : "state";
        insert.run(date, h.name, scope);
      }
    }
  });

  insertMany(years);
}
