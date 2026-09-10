# Home Office Tracker

A small single-user app to track home-office days against a 40-day yearly
allowance: how many days used/remaining, days left in the year, a reminder
banner before scheduled days, and a list of upcoming "bridge days" (weekdays
next to a holiday and a weekend) worth scheduling.

Design notes live in [`docs/specs/2026-09-10-homeoffice-tracker-design.md`](docs/specs/2026-09-10-homeoffice-tracker-design.md).

Stack: React Router v7 framework mode (Vite), Tailwind CSS, SQLite
(`better-sqlite3`), cookie-based session auth. One Node process serves
everything — no separate API server, no Docker required to run it.

## First-time setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your `.env` from the example and fill in real values:

   ```bash
   cp .env.example .env
   ```

   - `SESSION_SECRET` — generate one with
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `SEED_USERNAME` / `SEED_PASSWORD` — your login. Only used once, by the
     seed script below.
   - `DB_PATH` — leave as `./data/app.db` unless you want it elsewhere.

3. Create your account and seed national + SP-state holidays for this year
   and next:

   ```bash
   npm run seed
   ```

   This is safe to re-run — it updates your password if you change
   `SEED_PASSWORD` and re-run, and skips holidays it already has. Municipal
   (Jaguariúna) holidays aren't covered by any library, so add those once
   from the Settings page after logging in.

## Development

```bash
npm run dev
```

Opens at `http://localhost:5173`. From your phone on the same network, use
your machine's LAN IP instead of `localhost`.

## Tests

```bash
npm test
```

Covers the pure date/allowance/bridge-day logic in `app/lib/dates.ts` — the
places a bug would actually be costly (a wrong count or a wrong reminder).

## Production

```bash
npm run build
npm start
```

Serves the built app on `http://localhost:3000`. For a VPS: copy the repo
(or just `build/`, `package.json`, `package-lock.json`, and `scripts/`),
`npm install --omit=dev`, put a real `.env` next to it (never commit it),
run `npm run seed` once, then `npm start` behind a reverse proxy (nginx/
Caddy) with TLS. Keep `data/app.db` on a persistent volume/disk — it's the
only state the app has.

Behind a TLS-terminating proxy, the public hostname must be listed in
`allowedActionOrigins` in `react-router.config.ts` (or passed via the
`ALLOWED_ACTION_ORIGINS` env var **at build time**), otherwise React
Router's CSRF check rejects every form POST with "Bad Request". The proxy
should also forward the `Host` header.

## How the allowance/insights are computed

- **Used / remaining**: every row in `home_office_days` counts, whether the
  date is in the past ("used") or future ("scheduled") — both are treated as
  committed against the 40-day allowance for the calendar year.
- **Days left in year**: simple countdown to December 31.
- **Reminder banner**: shown when a logged day falls within
  `reminder_days_before` days of today (configurable in Settings, default 1).
  It's in-app only — there's no push notification or email; telling your
  team stays a manual step.
- **Bridge days**: a weekday is suggested when both the day before and the
  day after it are non-work days (a weekend or a holiday) — see
  `isBridgeDay` in `app/lib/dates.ts`.
