import { PlatformConfigProvider } from "@effect/platform"
import { NodeContext } from "@effect/platform-node"
import { Migrator, SqlClient } from "@effect/sql"
import { SqliteClient } from "@effect/sql-sqlite-node"
import { Config, Context, Effect, Layer, String } from "effect"
import * as path from "node:path"

export class AuthDb extends Context.Tag("@app/AuthDb")<
  AuthDb,
  SqlClient.SqlClient
>() {}

const initMigration = Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient
  yield* sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL,
      last_login_at INTEGER
    )
  `
  yield* sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      user_agent TEXT,
      ip_address TEXT
    )
  `
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`
  yield* sql`
    CREATE TABLE IF NOT EXISTS login_attempts (
      ip_address TEXT NOT NULL,
      attempted_at INTEGER NOT NULL,
      succeeded INTEGER NOT NULL DEFAULT 0
    )
  `
  yield* sql`CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, attempted_at)`
  yield* sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      event TEXT NOT NULL,
      user_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL
    )
  `
})

export const AuthDbLive: Layer.Layer<AuthDb, never, never> = Layer.unwrapEffect(
  Effect.gen(function*() {
    const dbPath = yield* Config.string("AUTH_DB_PATH").pipe(
      Config.withDefault("./auth.db")
    )

    const sqliteLayer = SqliteClient.layer({
      filename: dbPath,
      transformResultNames: String.snakeToCamel,
      transformQueryNames: String.camelToSnake
    })

    return Layer.effect(
      AuthDb,
      Effect.gen(function*() {
        const sql = yield* SqlClient.SqlClient
        yield* Migrator.make({})(
          { loader: Migrator.fromRecord({ "0001_init": initMigration }) }
        ).pipe(Effect.orDie)
        return sql
      })
    ).pipe(Layer.provide(sqliteLayer))
  })
).pipe(
  Layer.provide(PlatformConfigProvider.layerDotEnv(path.join(process.cwd(), ".env"))),
  Layer.provide(NodeContext.layer),
  Layer.orDie
)
