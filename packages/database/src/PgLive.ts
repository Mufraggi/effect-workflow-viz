import { PlatformConfigProvider } from "@effect/platform"
import { NodeContext } from "@effect/platform-node"
import { PgClient } from "@effect/sql-pg"
import { Config, Effect, identity, Layer, Redacted, String } from "effect"
import * as path from "node:path"
import pgTypes from "pg-types"

pgTypes.setTypeParser(1082, identity) // DATE
pgTypes.setTypeParser(1114, identity) // TIMESTAMP
pgTypes.setTypeParser(1184, identity)

// ---- NEW: Factory for building a PgClient layer from static config ----
// Useful when the connection details come from a dynamic source (e.g. a
// user-managed environment record) rather than environment variables.
export const makePgLayer = (params: {
  readonly host: string
  readonly port: string
  readonly user: string
  readonly password: string
  readonly dbName: string
  readonly ssl: boolean
}) =>
  Layer.unwrapEffect(
    Effect.sync(() => {
      const url = `postgres://${params.user}:${params.password}@${params.host}:${params.port}/${params.dbName}`
      return PgClient.layer({
        url: Redacted.make(url),
        ssl: params.ssl,
        maxConnections: 5,
        transformQueryNames: String.camelToSnake,
        transformResultNames: String.snakeToCamel,
        types: pgTypes
      })
    })
  ).pipe(Layer.provide(NodeContext.layer))

// ---- KEEP existing PgLive as-is (reads from env vars) ----
export const PgLive = Layer.unwrapEffect(
  Effect.gen(function*() {
    const database = yield* Config.string("DB_HOST")
    const username = yield* Config.string("DB_USER")
    const port = yield* Config.string("DB_PORT")
    const password = yield* Config.string("DB_PWD")
    const dbName = yield* Config.string("DB_NAME")
    const env = yield* Config.string("ENV")

    const url = `postgres://${username}:${password}@${database}:${port}/${dbName}`
    let ssl = false
    if (env === "production" || database.includes("azure.com")) {
      ssl = true
    }

    return PgClient.layer({
      url: Redacted.make(url),
      ssl,
      maxConnections: 5,
      transformQueryNames: String.camelToSnake,
      transformResultNames: String.snakeToCamel,
      // - 114: JSON (return as string instead of parsed object)
      // - 1082: DATE
      // - 1114: TIMESTAMP WITHOUT TIME ZONE
      // - 1184: TIMESTAMP WITH TIME ZONE
      // - 3802: JSONB (return as string instead of parsed object)
      types: pgTypes
    })
  })
).pipe(
  // `layerDotEnvAdd` overlays a local `.env` (for dev) on top of the OS
  // environment without replacing it, and tolerates the file being absent — so
  // a container with the variables injected straight into `process.env` works
  // without shipping a `.env`. (`layerDotEnv` would throw ENOENT here.)
  Layer.provide(PlatformConfigProvider.layerDotEnvAdd(path.join(process.cwd(), ".env"))),
  Layer.provide(NodeContext.layer)
)
