import { SqlClient } from "@effect/sql"
import { PgClient } from "@effect/sql-pg"
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { Effect, identity, Redacted, String } from "effect"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import pgTypes from "pg-types"

pgTypes.setTypeParser(1082, identity)
pgTypes.setTypeParser(1114, identity)
pgTypes.setTypeParser(1184, identity)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = path.join(__dirname, "cluster-schema.sql")

export const startPgContainer = (): Promise<StartedPostgreSqlContainer> =>
  new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("test")
    .withUsername("test")
    .withPassword("test")
    .start()

export const sqlLayerFor = (container: StartedPostgreSqlContainer) =>
  PgClient.layer({
    url: Redacted.make(container.getConnectionUri()),
    ssl: false,
    maxConnections: 4,
    transformQueryNames: String.camelToSnake,
    transformResultNames: String.snakeToCamel,
    types: pgTypes
  })

export const applyClusterSchema = Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient
  const ddl = yield* Effect.promise(() => fs.readFile(SCHEMA_PATH, "utf8"))
  const statements = ddl
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  for (const stmt of statements) {
    yield* sql.unsafe(stmt)
  }
})
