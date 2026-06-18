import { GetChildRunsQuery } from "@template/api/run/query/GetChildRunsQuery"
import { GetRunQuery } from "@template/api/run/query/GetRunQuery"
import { ListRunsQuery } from "@template/api/run/query/ListRunsQuery"
import { AuthRepository } from "@template/auth/AuthRepository"
import { PgLive } from "@template/database/PgLive"
import { DbManager } from "@template/environments/DbManager"
import { EnvironmentRepository } from "@template/environments/EnvironmentRepository"
import { Layer, ManagedRuntime } from "effect"

/**
 * The application layer shared across all Remix route handlers.
 */
const ReadLayer = Layer.mergeAll(
  ListRunsQuery.Default,
  GetRunQuery.Default,
  GetChildRunsQuery.Default
).pipe(Layer.provideMerge(PgLive))

/**
 * Root layer: workflow queries + SQLite-backed services + DbManager.
 *
 * Both AuthRepository.Default and EnvironmentRepository.Default now
 * bundle SqliteLive in their dependencies, so SqlClient resolves without
 * additional provision at the merge level.
 */
const AppLayer = Layer.mergeAll(
  ReadLayer,
  AuthRepository.Default,
  EnvironmentRepository.Default,
  DbManager.Default
)

/**
 * A long-lived Effect runtime. Built once at module load and reused for every
 * request via `runtime.runPromise(effect)` inside controllers.
 */
export const runtime = ManagedRuntime.make(AppLayer as any)
