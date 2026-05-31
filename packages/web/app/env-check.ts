// Fail-fast environment validation, run once at boot — imported from
// `server.ts` immediately after `env.ts` has loaded any local `.env` into
// `process.env`.
//
// Without this, the Effect config layers (PgLive, SqliteLive) only fail lazily
// on the first DB access, with an opaque ConfigError buried in a request's 500.
// Checking here surfaces every missing variable up front, with a clear message
// and a non-zero exit — so a misconfigured container dies on startup instead of
// silently serving errors.

const isProd = process.env.NODE_ENV === "production"

// Always required: the read-only Postgres connection (see @template/database PgLive).
const required = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PWD", "DB_NAME", "ENV"]

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
