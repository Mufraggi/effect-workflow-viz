import { GetChildRunsQuery } from "@template/api/run/query/GetChildRunsQuery"
import { GetRunQuery } from "@template/api/run/query/GetRunQuery"
import { ListRunsQuery } from "@template/api/run/query/ListRunsQuery"
import { AuthRepository } from "@template/auth/AuthRepository"
import { PgLive } from "@template/database/PgLive"
import { Layer, ManagedRuntime } from "effect"

/**
 * The application layer shared across all Remix route handlers.
 *
 * The query services are reused verbatim from `@template/api` — they only depend
 * on `WorkflowReader`, which in turn needs the Postgres client provided by `PgLive`.
 * Providing `PgLive` once here gives every loader a single shared connection pool.
 */
const ReadLayer = Layer.mergeAll(
  ListRunsQuery.Default,
  GetRunQuery.Default,
  GetChildRunsQuery.Default
  // `provideMerge` (vs `provide`) keeps `SqlClient` in the output context as
  // well as feeding it to the queries, so the readiness probe (`Health.ping`)
  // can reuse the same pool instead of opening a second connection.
).pipe(Layer.provideMerge(PgLive))

/**
 * Auth lives in its own writable SQLite DB (kept separate from the read-only
 * Postgres workflow DB). `AuthRepository.Default` already bundles `SqliteLive`
 * via its declared `dependencies`.
 */
const AppLayer = Layer.mergeAll(ReadLayer, AuthRepository.Default)

/**
 * A long-lived Effect runtime. Built once at module load and reused for every
 * request via `runtime.runPromise(effect)` inside controllers.
 */
export const runtime = ManagedRuntime.make(AppLayer)
