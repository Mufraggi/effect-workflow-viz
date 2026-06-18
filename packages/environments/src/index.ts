/**
 * DbManager resolves environment ids to live PgClient pools.
 *
 * Each pool is created lazily and **cached** via `Effect.cachedFunction`:
 * the first call per environment opens the Postgres pool; subsequent calls
 * reuse the same pool.  This lets the UI switch freely between environments
 * without connection churn.
 *
 * Because the service is declared as `scoped`, all pools are torn down when
 * the root application scope finalises (graceful shutdown).
 */
export * as DbManager from "./DbManager.js"

/**
 * Represents a single environment connection config (e.g. "Production", "Pre-prod").
 * Stored in the same writable SQLite DB that backs auth so it can be managed from
 * the UI without a separate migration runner.
 *
 * Passwords are stored in plain text — this is a deliberate UX trade-off for a
 * local/self-hosted admin tool.
 *
 * @see https://github.com/Effect-TS/effect
 */
export * as EnvironmentConfig from "./EnvironmentConfig.js"

/**
 * Manages environment connection configs inside the auth SQLite DB.
 *
 * The table is created idempotently on first use, mirroring how
 * `AuthRepository` handles the `users` table.
 */
export * as EnvironmentRepository from "./EnvironmentRepository.js"
