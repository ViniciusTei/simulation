import { describe, expect, it } from "vitest";
import {
  addDays,
  allowanceSummary,
  daysBetween,
  daysUntilYearEnd,
  isBridgeDay,
  isWeekend,
  nextReminderDate,
  statusOf,
  upcomingBridgeDays,
} from "./dates";

describe("addDays / daysBetween", () => {
  it("adds and subtracts days across month boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("computes whole-day differences", () => {
    expect(daysBetween("2026-01-01", "2026-01-10")).toBe(9);
    expect(daysBetween("2026-01-10", "2026-01-01")).toBe(-9);
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
  });
});

describe("isWeekend", () => {
  it("flags Saturday and Sunday only", () => {
    expect(isWeekend("2026-09-12")).toBe(true); // Saturday
    expect(isWeekend("2026-09-13")).toBe(true); // Sunday
    expect(isWeekend("2026-09-14")).toBe(false); // Monday
  });
});

describe("daysUntilYearEnd", () => {
  it("counts to Dec 31 of the same year", () => {
    expect(daysUntilYearEnd("2026-12-31")).toBe(0);
    expect(daysUntilYearEnd("2026-12-01")).toBe(30);
  });
});

describe("allowanceSummary", () => {
  it("counts only days within the given year, past and future alike", () => {
    const summary = allowanceSummary(
      ["2026-01-05", "2026-06-10", "2027-01-02", "2025-12-30"],
      2026,
      40,
    );
    expect(summary).toEqual({ year: 2026, used: 2, remaining: 38, total: 40 });
  });

  it("never reports negative remaining if over allowance", () => {
    const dates = Array.from({ length: 42 }, (_, i) =>
      addDays("2026-01-01", i),
    );
    const summary = allowanceSummary(dates, 2026, 40);
    expect(summary.used).toBe(42);
    expect(summary.remaining).toBe(0);
  });
});

describe("statusOf", () => {
  it("is used for today and the past, scheduled for the future", () => {
    expect(statusOf("2026-09-01", "2026-09-10")).toBe("used");
    expect(statusOf("2026-09-10", "2026-09-10")).toBe("used");
    expect(statusOf("2026-09-11", "2026-09-10")).toBe("scheduled");
  });
});

describe("isBridgeDay", () => {
  it("flags Friday when Thursday is a holiday", () => {
    // 2026-04-21 (Tiradentes) is a Tuesday in real life; use a synthetic
    // Thursday holiday for a clean test instead.
    const holidays = new Set(["2026-09-10"]); // Thursday
    expect(isBridgeDay("2026-09-11", holidays)).toBe(true); // Friday
  });

  it("flags Monday when Tuesday is a holiday", () => {
    const holidays = new Set(["2026-09-15"]); // Tuesday
    expect(isBridgeDay("2026-09-14", holidays)).toBe(true); // Monday
  });

  it("does not flag a weekend day", () => {
    const holidays = new Set(["2026-09-10"]);
    expect(isBridgeDay("2026-09-12", holidays)).toBe(false); // Saturday
  });

  it("does not flag a holiday itself", () => {
    const holidays = new Set(["2026-09-10"]);
    expect(isBridgeDay("2026-09-10", holidays)).toBe(false);
  });

  it("does not flag a weekday with no adjacent non-work day", () => {
    const holidays = new Set(["2026-09-10"]); // Thursday
    expect(isBridgeDay("2026-09-08", holidays)).toBe(false); // Tuesday, unrelated
  });

  it("flags a day sandwiched between two holidays", () => {
    const holidays = new Set(["2026-09-14", "2026-09-16"]); // Mon, Wed
    expect(isBridgeDay("2026-09-15", holidays)).toBe(true); // Tuesday
  });
});

describe("upcomingBridgeDays", () => {
  it("finds bridge days in the horizon and excludes already-logged ones", () => {
    const holidays = [{ date: "2026-09-10", name: "Test Holiday" }]; // Thursday
    const results = upcomingBridgeDays(
      "2026-09-01",
      30,
      holidays,
      new Set(),
    );
    expect(results).toEqual([
      { date: "2026-09-11", adjacentHoliday: "Test Holiday" },
    ]);
  });

  it("excludes a bridge day that's already logged", () => {
    const holidays = [{ date: "2026-09-10", name: "Test Holiday" }];
    const results = upcomingBridgeDays(
      "2026-09-01",
      30,
      holidays,
      new Set(["2026-09-11"]),
    );
    expect(results).toEqual([]);
  });
});

describe("nextReminderDate", () => {
  it("returns the soonest scheduled date within the threshold", () => {
    const dates = ["2026-09-08", "2026-09-12", "2026-09-20"];
    expect(nextReminderDate(dates, "2026-09-10", 2)).toBe("2026-09-12");
  });

  it("returns null when nothing is within the threshold", () => {
    const dates = ["2026-09-01", "2026-09-25"];
    expect(nextReminderDate(dates, "2026-09-10", 2)).toBeNull();
  });

  it("includes today itself", () => {
    expect(nextReminderDate(["2026-09-10"], "2026-09-10", 1)).toBe(
      "2026-09-10",
    );
  });
});
