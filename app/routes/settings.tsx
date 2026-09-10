import bcrypt from "bcryptjs";
import { Form, useActionData } from "react-router";
import {
  addCustomHoliday,
  getAllHolidays,
  getReminderDaysBefore,
  getUserById,
  removeHoliday,
  setReminderDaysBefore,
  updateUserPassword,
} from "~/db/queries.server";
import { requireUserId } from "~/session.server";
import type { Route } from "./+types/settings";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserId(request);
  return {
    holidays: getAllHolidays(),
    reminderDaysBefore: getReminderDaysBefore(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "add_holiday") {
    const date = String(formData.get("date") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const scope = String(formData.get("scope") ?? "custom") as
      | "state"
      | "city"
      | "custom";
    if (!date || !name) return { error: "Date and name are required." };
    addCustomHoliday(date, name, scope);
    return { ok: true };
  }

  if (intent === "remove_holiday") {
    const id = Number(formData.get("id"));
    if (id) removeHoliday(id);
    return { ok: true };
  }

  if (intent === "update_reminder") {
    const days = Number(formData.get("reminder_days_before"));
    if (Number.isFinite(days) && days >= 0) setReminderDaysBefore(days);
    return { ok: true };
  }

  if (intent === "change_password") {
    const currentPassword = String(formData.get("current_password") ?? "");
    const newPassword = String(formData.get("new_password") ?? "");
    const user = getUserById(userId);
    if (!user) return { error: "User not found." };
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return { error: "Current password is incorrect." };
    if (newPassword.length < 8) {
      return { error: "New password must be at least 8 characters." };
    }
    const hash = await bcrypt.hash(newPassword, 10);
    updateUserPassword(userId, hash);
    return { passwordChanged: true };
  }

  return { ok: false };
}

const SCOPE_LABEL: Record<string, string> = {
  national: "National",
  state: "State (SP)",
  city: "City (Jaguariúna)",
  custom: "Custom",
};

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { holidays, reminderDaysBefore } = loaderData;
  const actionData = useActionData<typeof action>();

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Reminder
        </h2>
        <Form method="post" className="flex items-end gap-3">
          <input type="hidden" name="intent" value="update_reminder" />
          <div>
            <label
              htmlFor="reminder_days_before"
              className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
            >
              Alert me this many days before a scheduled day
            </label>
            <input
              id="reminder_days_before"
              name="reminder_days_before"
              type="number"
              min={0}
              max={14}
              defaultValue={reminderDaysBefore}
              className="w-24 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
          >
            Save
          </button>
        </Form>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Holidays
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          National and SP-state holidays are seeded automatically and can't be
          removed here. Add Jaguariúna city holidays or any other custom day
          off below.
        </p>

        <Form
          method="post"
          className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b border-gray-200 dark:border-gray-800"
        >
          <input type="hidden" name="intent" value="add_holiday" />
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Date
            </label>
            <input
              type="date"
              name="date"
              required
              className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Name
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. Aniversário de Jaguariúna"
              className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Scope
            </label>
            <select
              name="scope"
              defaultValue="city"
              className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            >
              <option value="city">City</option>
              <option value="state">State</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-3 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
          >
            Add
          </button>
        </Form>
        {actionData && "error" in actionData && actionData.error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">
            {actionData.error}
          </p>
        )}

        <ul className="divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          {holidays.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-900 text-sm"
            >
              <div>
                <span className="text-gray-900 dark:text-gray-100">
                  {h.date}
                </span>{" "}
                <span className="text-gray-500 dark:text-gray-400">
                  {h.name}
                </span>
                <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                  {SCOPE_LABEL[h.scope]}
                </span>
              </div>
              {h.scope !== "national" && (
                <Form method="post">
                  <input type="hidden" name="intent" value="remove_holiday" />
                  <input type="hidden" name="id" value={h.id} />
                  <button
                    type="submit"
                    className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    Remove
                  </button>
                </Form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Change password
        </h2>
        <Form method="post" className="space-y-3 max-w-sm">
          <input type="hidden" name="intent" value="change_password" />
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Current password
            </label>
            <input
              type="password"
              name="current_password"
              required
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              New password
            </label>
            <input
              type="password"
              name="new_password"
              required
              minLength={8}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          {actionData && "passwordChanged" in actionData && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              Password updated.
            </p>
          )}
          <button
            type="submit"
            className="px-3 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
          >
            Update password
          </button>
        </Form>
      </section>
    </div>
  );
}
