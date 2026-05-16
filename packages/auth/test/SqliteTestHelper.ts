import { SqlClient } from "@effect/sql"
import { SqliteClient } from "@effect/sql-sqlite-node"
import { Effect, Layer, String } from "effect"
import { AuthDb } from "../src/db/AuthDb.js"

const sqliteMemoryLayer = SqliteClient.layer({
  filename: ":memory:",
  transformResultNames: String.snakeToCamel,
  transformQueryNames: String.camelToSnake
})

const applySchema = Effect.gen(function*() {
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
})

export const authDbTestLayer: Layer.Layer<AuthDb, never, never> = Layer.effect(
  AuthDb,
  Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient
    yield* applySchema
    return sql
  })
).pipe(Layer.provide(sqliteMemoryLayer), Layer.orDie)
