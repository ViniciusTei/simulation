import type { Config } from "@react-router/dev/config";

// Public hosts allowed to submit form actions. Required when running behind a
// TLS-terminating reverse proxy (nginx / Cloudflare): the browser sends
// `Origin: https://<host>`, but `react-router-serve` runs a plain Express app
// with no `trust proxy`, so it believes it is serving `http://<host>`. Without
// a match here, React Router's action CSRF check rejects every POST with
// "Bad Request" (login, logging a day, settings — all broken).
//
// Extend at build time with ALLOWED_ACTION_ORIGINS (comma-separated). Only
// consulted when the forwarded origin differs from what the server sees, so it
// has no effect on local dev.
const allowedActionOrigins = [
  "tracker.viniciustei.com.br",
  ...(process.env.ALLOWED_ACTION_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? []),
];

export default {
  // Server-side render by default; set to `false` for SPA mode.
  ssr: true,
  allowedActionOrigins,
} satisfies Config;
