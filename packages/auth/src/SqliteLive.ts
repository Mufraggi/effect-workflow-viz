import { PlatformConfigProvider } from "@effect/platform"
import { NodeContext } from "@effect/platform-node"
import { SqliteClient } from "@effect/sql-sqlite-node"
import { Config, Effect, Layer, String } from "effect"
import * as fs from "node:fs"
import * as path from "node:path"

/**
 * The writable SQLite layer that backs authentication.
 *
 * Kept entirely separate from the read-only Postgres workflow database
 * (`@template/database`'s `PgLive`) so auth never pollutes the user's data.
 * The file location is configurable via `AUTH_DB_PATH` (default `./data/auth.db`);
 * mount it on a persistent Docker volume so the first-run setup flow only runs once.
 */
export const SqliteLive = Layer.unwrapEffect(
  Effect.gen(function*() {
    const filename = yield* Config.string("AUTH_DB_PATH").pipe(
      Config.withDefault("./data/auth.db")
    )

    // better-sqlite3 does not create the parent directory — ensure it exists.
    const dir = path.dirname(path.resolve(filename))
    yield* Effect.sync(() => fs.mkdirSync(dir, { recursive: true }))

    return SqliteClient.layer({
      filename,
      transformQueryNames: String.camelToSnake,
      transformResultNames: String.snakeToCamel
    })
  })
).pipe(
  Layer.provide(PlatformConfigProvider.layerDotEnv(path.join(process.cwd(), ".env"))),
  Layer.provide(NodeContext.layer)
)
