import { GetChildRunsQuery } from "@template/api/run/query/GetChildRunsQuery"
import { GetRunQuery } from "@template/api/run/query/GetRunQuery"
import { ListRunsQuery } from "@template/api/run/query/ListRunsQuery"
import { PgLive } from "@template/database/PgLive"
import { Layer, ManagedRuntime } from "effect"

/**
 * The application layer shared across all Remix route handlers.
 *
 * The query services are reused verbatim from `@template/api` — they only depend
 * on `WorkflowReader`, which in turn needs the Postgres client provided by `PgLive`.
 * Providing `PgLive` once here gives every loader a single shared connection pool.
 */
const AppLayer = Layer.mergeAll(
  ListRunsQuery.Default,
  GetRunQuery.Default,
  GetChildRunsQuery.Default
).pipe(Layer.provide(PgLive))

/**
 * A long-lived Effect runtime. Built once at module load and reused for every
 * request via `runtime.runPromise(effect)` inside controllers.
 */
export const runtime = ManagedRuntime.make(AppLayer)
