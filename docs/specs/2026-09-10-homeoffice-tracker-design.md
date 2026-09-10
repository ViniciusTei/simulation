# Home Office Tracker — Design

## Purpose

Vinicius has 40 allowed home-office days per calendar year at his company, with no
system to track them. This app is a personal, single-user web tool (usable on
desktop and phone) to log home-office days, see remaining balance, schedule future
days, get reminded before a scheduled day arrives, and see simple insights (days
left in the year, good upcoming days to take home office).

Explicitly out of scope: multi-user accounts, team notifications/integrations
(Slack, email, WhatsApp), push notifications, and automated messaging to
coworkers. Reminders are in-app only; telling the team stays a manual, human step.

## Tech stack

- **React Router v7, framework mode** (Vite-powered) — server-side loaders/actions,
  no separate API layer to hand-build.
- **Tailwind CSS** for styling.
- **SQLite** via `better-sqlite3` for storage.
- **React Router's built-in cookie session storage** for auth — a signed, httpOnly,
  long-lived (~90 day) cookie holding the logged-in user id. No server-side
  session table needed. Because the cookie lives only in the browser that logged
  in, a new device naturally requires a fresh login — this is the desired
  behavior, not something to build explicitly.
- Single Node process serves both the app and its data; deploys as one unit to a
  VPS later. No Docker/CI complexity for v1.

## Data model

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Single row, created by a seed script (see Auth section).

CREATE TABLE home_office_days (
  id INTEGER PRIMARY KEY,
  date TEXT UNIQUE NOT NULL,        -- ISO 'YYYY-MM-DD'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- A row = a home-office day. "Used" vs "scheduled" is NOT a stored field —
-- it's derived by comparing `date` to today: date <= today => used (past),
-- date > today => scheduled (future). Deleting a row un-schedules/removes it.

CREATE TABLE holidays (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,               -- ISO 'YYYY-MM-DD'
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('national', 'state', 'city', 'custom')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- 'national' rows are seeded on first run from a BR holidays library, for the
-- current year plus next year. 'state' (SP) and 'city' (Jaguariúna) rows have
-- no reliable API and are entered once via /settings. 'custom' rows are
-- anything else the user adds (e.g. a company-specific day off).

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- single row
  reminder_days_before INTEGER NOT NULL DEFAULT 1
);
```

Allowance year is the calendar year (Jan 1–Dec 31). "Days used" and "days
remaining" are always computed against the current calendar year: count rows in
`home_office_days` whose `date` falls in the current year, remaining = 40 minus
that count (scheduled future days count toward the total too, since they're
committed).

## Pages / routes

- **`/login`** — username + password form. Checks against the single seeded user.
  On success, sets the session cookie and redirects to `/`.
- **`/`** (dashboard) — the home screen:
  - Days used this year / days remaining out of 40 (simple stat display).
  - Days remaining until December 31 (countdown).
  - A reminder banner if any scheduled day falls within `reminder_days_before`
    days from today (e.g. "You have a home office day in 1 day — Sept 12").
  - A short list of upcoming "good days" — bridge days in the next ~60 days (see
    Insights below).
- **`/calendar`** — month-grid view. Click a date to add/remove a home-office day.
  Holidays are shown on the grid for context (so you can see why a day is
  flagged as a bridge day). Past dates show as "used", future dates as
  "scheduled", both visually the same weight since both count toward the 40.
- **`/settings`** — manage holidays (add/remove state/city/custom entries; national
  ones are read-only, re-seeded automatically each year), change
  `reminder_days_before`, change password.

## Insights logic

- **Days remaining in year**: `daysBetween(today, Dec 31 of current year)`. Pure
  date math.
- **Days used / remaining of the 40**: count of `home_office_days` rows in the
  current calendar year, `40 - count`.
- **Bridge days ("good days")**: a weekday (Mon–Fri) that is immediately adjacent
  (previous or next calendar day) to either a holiday or a weekend, such that
  taking it would sit inside a stretch where the office is already quiet — e.g.
  a holiday on Thursday flags Friday, a holiday on Tuesday flags Monday. Computed
  for the next 60 days from the `holidays` table; a day already logged in
  `home_office_days` is excluded from the suggestion list.
- **Reminder banner**: any `home_office_days` row with
  `today <= date <= today + reminder_days_before` and `date >= today` shows the
  in-app banner. No push notification, no email — purely rendered on page load
  when the dashboard is open.

## Auth flow

1. A one-time seed script (run manually, e.g. `npm run seed`) prompts for or
   accepts a username/password via env vars, hashes the password (bcrypt or
   argon2), and inserts the single row into `users`. No signup screen in the app
   itself.
2. `/login` action verifies username + password hash, then sets a signed httpOnly
   cookie (React Router `createCookieSessionStorage`) with a long `maxAge`
   (~90 days) containing the user id.
3. All other routes' loaders check the session cookie; missing/invalid session
   redirects to `/login`.
4. Logging in from a new device/browser has no session cookie yet, so it prompts
   for login again — this satisfies "log in once per device, ask again on a new
   one" without any extra device-tracking logic.

## Error handling

Kept intentionally minimal for a personal tool:

- Login: wrong credentials → inline error message on the form, no lockouts/rate
  limiting for v1.
- Scheduling: attempting to add a duplicate date is a no-op with a message
  ("already logged"); no restriction on weekends/holidays (allowed, just
  unusual — the user may have a reason).
- Any DB/server error surfaces as a simple flash/toast message rather than a raw
  stack trace.

## Testing approach

- Unit tests (Vitest) for the pure date/insight functions: days-remaining math,
  bridge-day detection, allowance counting. These are the only places bugs would
  actually be costly (wrong count, wrong reminder).
- No e2e test suite, no CI pipeline for v1 — manual testing is sufficient given
  single-user scope. Can be added later if the app grows.

## Deployment (future, not part of this spec's implementation)

Single Node process (React Router's built server) behind a reverse proxy on the
VPS, SQLite file persisted on disk, `.env` for the cookie session secret and
seeded user credentials. No Docker/CI required for v1 — out of scope for now,
revisit when actually deploying.
