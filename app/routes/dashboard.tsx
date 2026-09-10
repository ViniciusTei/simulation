import { Form } from "react-router";
import {
  addHomeOfficeDay,
  getAllLoggedDates,
  getHolidaysInRange,
  getReminderDaysBefore,
} from "~/db/queries.server";
import {
  addDays,
  allowanceSummary,
  daysUntilYearEnd,
  nextReminderDate,
  todayISO,
  upcomingBridgeDays,
  yearOf,
} from "~/lib/dates";
import { requireUserId } from "~/session.server";
import type { Route } from "./+types/dashboard";

const BRIDGE_DAY_HORIZON = 60;

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserId(request);

  const today = todayISO();
  const loggedDates = getAllLoggedDates();
  const summary = allowanceSummary(loggedDates, yearOf(today));
  const reminderDaysBefore = getReminderDaysBefore();
  const reminderDate = nextReminderDate(
    loggedDates,
    today,
    reminderDaysBefore,
  );

  const horizonEnd = addDays(today, BRIDGE_DAY_HORIZON);
  const holidays = getHolidaysInRange(today, horizonEnd);
  const bridgeDays = upcomingBridgeDays(
    today,
    BRIDGE_DAY_HORIZON,
    holidays,
    new Set(loggedDates),
  );

  return {
    today,
    summary,
    daysUntilYearEnd: daysUntilYearEnd(today),
    reminderDate,
    bridgeDays,
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const date = String(formData.get("date") ?? "");
  if (date) addHomeOfficeDay(date);
  return { ok: true };
}

function formatLong(dateISO: string) {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { summary, daysUntilYearEnd, reminderDate, bridgeDays } = loaderData;

  return (
    <div className="space-y-6">
      {reminderDate && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          You have a home office day coming up on{" "}
          <strong>{formatLong(reminderDate)}</strong>.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Used this year" value={summary.used} />
        <StatCard label="Remaining" value={summary.remaining} />
        <StatCard label="Total allowance" value={summary.total} />
        <StatCard label="Days left in year" value={daysUntilYearEnd} />
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Good upcoming days
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Bridge days in the next {BRIDGE_DAY_HORIZON} days — weekdays sandwiched
          between a holiday and a weekend.
        </p>
        {bridgeDays.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No bridge days coming up.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            {bridgeDays.map((b) => (
              <li
                key={b.date}
                className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatLong(b.date)}
                  </p>
                  {b.adjacentHoliday && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      next to {b.adjacentHoliday}
                    </p>
                  )}
                </div>
                <Form method="post">
                  <input type="hidden" name="date" value={b.date} />
                  <button
                    type="submit"
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Schedule
                  </button>
                </Form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
