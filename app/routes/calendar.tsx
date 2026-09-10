import { Form, Link } from "react-router";
import {
  addHomeOfficeDay,
  getAllLoggedDates,
  getHolidaysInRange,
  removeHomeOfficeDay,
} from "~/db/queries.server";
import { isWeekend, statusOf, todayISO, toISO } from "~/lib/dates";
import { requireUserId } from "~/session.server";
import type { Route } from "./+types/calendar";

function parseMonthParam(value: string | null): { year: number; month: number } {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserId(request);
  const url = new URL(request.url);
  const { year, month } = parseMonthParam(url.searchParams.get("month"));

  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const holidays = getHolidaysInRange(toISO(gridStart), toISO(gridEnd));
  const holidayByDate = new Map(holidays.map((h) => [h.date, h.name]));
  const loggedDates = new Set(getAllLoggedDates());
  const today = todayISO();

  const days: {
    date: string;
    inMonth: boolean;
    weekend: boolean;
    holidayName: string | null;
    logged: boolean;
    status: "used" | "scheduled" | null;
  }[] = [];

  for (
    let d = new Date(gridStart);
    d <= gridEnd;
    d.setDate(d.getDate() + 1)
  ) {
    const date = toISO(d);
    days.push({
      date,
      inMonth: d.getMonth() === month,
      weekend: isWeekend(date),
      holidayName: holidayByDate.get(date) ?? null,
      logged: loggedDates.has(date),
      status: loggedDates.has(date) ? statusOf(date, today) : null,
    });
  }

  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);

  return {
    year,
    month,
    monthLabel: firstOfMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    days,
    prevMonthKey: monthKey(prevMonth.getFullYear(), prevMonth.getMonth()),
    nextMonthKey: monthKey(nextMonth.getFullYear(), nextMonth.getMonth()),
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireUserId(request);
  const formData = await request.formData();
  const date = String(formData.get("date") ?? "");
  const intent = String(formData.get("intent") ?? "");
  if (!date) return { ok: false };

  if (intent === "remove") {
    removeHomeOfficeDay(date);
  } else {
    addHomeOfficeDay(date);
  }
  return { ok: true };
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Calendar({ loaderData }: Route.ComponentProps) {
  const { monthLabel, days, prevMonthKey, nextMonthKey } = loaderData;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          to={`/calendar?month=${prevMonthKey}`}
          className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          ← Prev
        </Link>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {monthLabel}
        </h2>
        <Link
          to={`/calendar?month=${nextMonthKey}`}
          className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Next →
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 dark:text-gray-400">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => (
          <DayCell key={day.date} day={day} />
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2">
        <Legend swatch="bg-emerald-500" label="Home office (used)" />
        <Legend swatch="bg-indigo-500" label="Home office (scheduled)" />
        <Legend swatch="bg-rose-200 dark:bg-rose-900" label="Holiday" />
      </div>
    </div>
  );
}

function DayCell({
  day,
}: {
  day: Route.ComponentProps["loaderData"]["days"][number];
}) {
  const isToday = day.date === todayISO();

  let bg = "bg-white dark:bg-gray-900";
  if (day.status === "used") bg = "bg-emerald-500 text-white";
  else if (day.status === "scheduled") bg = "bg-indigo-500 text-white";
  else if (day.holidayName) bg = "bg-rose-100 dark:bg-rose-950";
  else if (day.weekend) bg = "bg-gray-100 dark:bg-gray-900";

  const dimmed = !day.inMonth ? "opacity-40" : "";

  return (
    <Form method="post" className={dimmed}>
      <input type="hidden" name="date" value={day.date} />
      <input
        type="hidden"
        name="intent"
        value={day.logged ? "remove" : "add"}
      />
      <button
        type="submit"
        disabled={!day.inMonth}
        title={day.holidayName ?? undefined}
        className={`w-full aspect-square rounded-md text-xs flex flex-col items-center justify-center gap-0.5 border ${
          isToday
            ? "border-indigo-500"
            : "border-gray-200 dark:border-gray-800"
        } ${bg} disabled:cursor-default`}
      >
        <span>{Number(day.date.slice(8, 10))}</span>
        {day.holidayName && !day.logged && (
          <span className="w-1 h-1 rounded-full bg-rose-500" />
        )}
      </button>
    </Form>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}
