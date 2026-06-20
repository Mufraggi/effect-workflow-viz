// Fail-fast environment validation, run once at boot — imported from
// `server.ts` immediately after `env.ts` has loaded any local `.env` into
// `process.env`.
//
// Without this, the Effect config layers (SqliteLive) only fail lazily on the
// first access, with an opaque ConfigError buried in a request's 500. Checking
// here surfaces every missing variable up front, with a clear message and a
// non-zero exit — so a misconfigured container dies on startup instead of
// silently serving errors.
//
// Note: Postgres connections are no longer configured via `.env`. They are
// resolved per-environment by DbManager from the SQLite environments store, so
// no DB_* variables are required here.

const isProd = process.env.NODE_ENV === "production"

const required: Array<string> = []

// Required only in production: the session-cookie signing secret. In dev,
// app/auth/cookie.ts falls back to a fixed insecure secret so the app boots.
if (isProd) required.push("SESSION_SECRET")

const missing = required.filter((key) => {
  const value = process.env[key]
  return value === undefined || value.trim() === ""
})

if (missing.length > 0) {
  const plural = missing.length > 1
  process.stderr.write(
    `\n✗ Missing required environment variable${plural ? "s" : ""}: ${missing.join(", ")}\n` +
      `  Set ${plural ? "them" : "it"} in the environment or a local .env file (see .env.example).\n` +
      (missing.includes("SESSION_SECRET")
        ? "  SESSION_SECRET must be a long random string, e.g. `openssl rand -hex 32`.\n"
        : "") +
      "\n"
  )
  process.exit(1)
}
