import { PlatformConfigProvider } from "@effect/platform"
import { NodeContext } from "@effect/platform-node"
import { PgClient } from "@effect/sql-pg"
import { Config, Effect, identity, Layer, Redacted, String } from "effect"
import * as path from "node:path"
import pgTypes from "pg-types"

pgTypes.setTypeParser(1082, identity) // DATE
pgTypes.setTypeParser(1114, identity) // TIMESTAMP
pgTypes.setTypeParser(1184, identity) // TIMESTAMPTZ

export const PgLive = Layer.unwrapEffect(
  Effect.gen(function*() {
    const database = yield* Config.string("DB_HOST")
    const username = yield* Config.string("DB_USER")
    const port = yield* Config.string("DB_PORT")
    const password = yield* Config.string("DB_PWD")
    const dbName = yield* Config.string("DB_NAME")

    const url = `postgres://${username}:${password}@${database}:${port}/${dbName}`
    const ssl = false

    return PgClient.layer({
      url: Redacted.make(url),
      ssl,
      maxConnections: 5,
      transformQueryNames: String.camelToSnake,
      transformResultNames: String.snakeToCamel,
      types: pgTypes
    })
  })
).pipe(
  Layer.provide(PlatformConfigProvider.layerDotEnv(path.join(process.cwd(), ".env"))),
  Layer.provide(NodeContext.layer)
)
