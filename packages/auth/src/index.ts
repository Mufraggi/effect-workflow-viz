/**
 * The auth repository. Mirrors the `WorkflowReader` service pattern but over the
 * writable SQLite layer. The `users` table is created idempotently on first use
 * (single table — no migration runner needed for v1).
 */
export * as AuthRepository from "./AuthRepository.js"

/**
 * The writable SQLite layer that backs authentication.
 *
 * Kept entirely separate from the read-only Postgres workflow database
 * (`@template/database`'s `PgLive`) so auth never pollutes the user's data.
 * The file location is configurable via `AUTH_DB_PATH` (default `./data/auth.db`);
 * mount it on a persistent Docker volume so the first-run setup flow only runs once.
 */
export * as SqliteLive from "./SqliteLive.js"

/**
 * Hash a plaintext password with Argon2id (via oslo). The returned string is the
 * standard `$argon2id$...` encoding, carrying its own salt and parameters.
 */
export * as password from "./password.js"
