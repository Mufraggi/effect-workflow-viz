import { AuthRepository } from "@template/auth/AuthRepository"
import { DbManager } from "@template/environments/DbManager"
import { EnvironmentRepository } from "@template/environments/EnvironmentRepository"
import { Layer, ManagedRuntime } from "effect"

/**
 * Root layer: SQLite-backed services + DbManager.
 *
 * All Postgres access goes through DbManager.getClient(envId), which builds a
 * connection from the environment configuration stored in SQLite (auth.db) —
 * the app never reads DB_* from `.env`.
 *
 * Both AuthRepository.Default and EnvironmentRepository.Default bundle
 * SqliteLive in their dependencies, so SqlClient resolves without additional
 * provision at the merge level.
 */
const AppLayer = Layer.mergeAll(
  AuthRepository.Default,
  EnvironmentRepository.Default,
  DbManager.Default
)

/**
 * A long-lived Effect runtime. Built once at module load and reused for every
 * request via `runtime.runPromise(effect)` inside controllers.
 */
export const runtime = ManagedRuntime.make(AppLayer)
