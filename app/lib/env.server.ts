// Centralized env var access. Values are loaded by Node's built-in
// `--env-file=.env` flag (see package.json scripts) — nothing here reads
// the file itself.

function required(name: string, devFallback?: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV !== "production" && devFallback !== undefined) {
    return devFallback;
  }
  throw new Error(
    `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
  );
}

export const env = {
  get sessionSecret() {
    return required("SESSION_SECRET", "dev-only-insecure-secret");
  },
  get dbPath() {
    return process.env.DB_PATH || "./data/app.db";
  },
  get seedUsername() {
    return process.env.SEED_USERNAME || "";
  },
  get seedPassword() {
    return process.env.SEED_PASSWORD || "";
  },
};
