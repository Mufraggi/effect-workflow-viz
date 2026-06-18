import { PgClient } from "@effect/sql-pg"
import { makePgLayer } from "@template/database/PgLive"
import { Effect, type Layer, ManagedRuntime } from "effect"
import { EnvironmentRepository } from "./EnvironmentRepository.js"

type PgLayer = ReturnType<typeof makePgLayer>
type PgRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<PgLayer>,
  Layer.Layer.Error<PgLayer>
>

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
export class DbManager extends Effect.Service<DbManager>()("DbManager", {
  scoped: Effect.gen(function*() {
    const envRepo = yield* EnvironmentRepository

    // Cache: map<envId, ManagedRuntime> so pools stay alive.
    const runtimes = new Map<string, PgRuntime>()

    const getClient = yield* Effect.cachedFunction((envId: string): Effect.Effect<PgClient.PgClient, Error> =>
      Effect.gen(function*() {
        const maybe = yield* envRepo.getById(envId)
        if (maybe === null) {
          return yield* Effect.fail(new Error(`Environment ${envId} not found`))
        }
        const env = maybe

        // Check cache first
        const existing = runtimes.get(envId)
        if (existing) {
          return yield* Effect.promise(() => existing.runPromise(PgClient.PgClient))
        }

        // Create a new pool via makePgLayer (same approach as PgLive.ts,
        // uses PgClient.layer which doesn't require Reactivity).
        const rt = ManagedRuntime.make(
          makePgLayer({
            host: env.host,
            port: env.port,
            user: env.user,
            password: env.password,
            dbName: env.dbName,
            ssl: env.ssl
          })
        )
        runtimes.set(envId, rt)

        return yield* Effect.promise(() => rt.runPromise(PgClient.PgClient))
      })
    )

    return { getClient } as const
  }),
  dependencies: [EnvironmentRepository.Default]
}) {}
