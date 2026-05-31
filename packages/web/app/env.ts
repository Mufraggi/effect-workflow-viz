// Load the local `.env` into `process.env` (Node-native, no dependency) so plain
// `process.env` reads — e.g. SESSION_SECRET in `app/auth/cookie.ts` — see it.
// The Effect config layers read the `.env` file directly and don't rely on this.
// Imported first in `server.ts` so it runs before any module that reads env.
try {
  process.loadEnvFile()
} catch {
  // No `.env` present — fall back to the ambient environment.
}
