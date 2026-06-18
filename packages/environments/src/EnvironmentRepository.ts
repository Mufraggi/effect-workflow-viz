import { SqlClient, SqlSchema } from "@effect/sql"
import { SqliteLive } from "@template/auth/SqliteLive"
import { Effect, Option, Schema } from "effect"
import * as crypto from "node:crypto"
import { EnvironmentConfig } from "./EnvironmentConfig.js"

// ---------------------------------------------------------------------------
// Internal row schema – mirrors the SQLite column layout.
// Boolean columns are stored as INTEGER (0/1) so we read them as Number and
// convert to boolean when constructing the domain model.
// ---------------------------------------------------------------------------

const EnvironmentRow = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  host: Schema.String,
  port: Schema.String,
  user: Schema.String,
  password: Schema.String,
  dbName: Schema.String,
  ssl: Schema.Number,
  isDefault: Schema.Number,
  createdAt: Schema.DateFromString
})

type EnvironmentRow = typeof EnvironmentRow.Type

const toConfig = (row: EnvironmentRow): EnvironmentConfig =>
  new EnvironmentConfig({
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    user: row.user,
    password: row.password,
    dbName: row.dbName,
    ssl: row.ssl === 1,
    isDefault: row.isDefault === 1,
    createdAt: row.createdAt
  })

// ---------------------------------------------------------------------------
// Public input types
// ---------------------------------------------------------------------------

export interface EnvironmentCreateInput {
  readonly name: string
  readonly host: string
  readonly port?: string
  readonly user: string
  readonly password: string
  readonly dbName: string
  readonly ssl?: boolean
  readonly isDefault?: boolean
}

export interface EnvironmentUpdateInput {
  readonly name?: string
  readonly host?: string
  readonly port?: string
  readonly user?: string
  readonly password?: string
  readonly dbName?: string
  readonly ssl?: boolean
  readonly isDefault?: boolean
}

// ---------------------------------------------------------------------------
// Repository service
// ---------------------------------------------------------------------------

/**
 * Manages environment connection configs inside the auth SQLite DB.
 *
 * The table is created idempotently on first use, mirroring how
 * `AuthRepository` handles the `users` table.
 */
export class EnvironmentRepository extends Effect.Service<EnvironmentRepository>()(
  "EnvironmentRepository",
  {
    effect: Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient

      yield* sql`
        CREATE TABLE IF NOT EXISTS environments (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          host TEXT NOT NULL,
          port TEXT NOT NULL DEFAULT '5432',
          user TEXT NOT NULL,
          password TEXT NOT NULL,
          db_name TEXT NOT NULL,
          ssl INTEGER NOT NULL DEFAULT 0,
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `

      // -----------------------------------------------------------------------
      // Queries
      // -----------------------------------------------------------------------

      const listSchema = SqlSchema.findAll({
        Request: Schema.Void,
        Result: EnvironmentRow,
        execute: () =>
          sql`SELECT id, name, host, port, user, password, db_name, ssl, is_default, created_at FROM environments ORDER BY name ASC`
      })
      const list = listSchema(undefined).pipe(
        Effect.map((rows) => rows.map(toConfig)),
        Effect.orDie,
        Effect.withSpan("EnvironmentRepository.list")
      )

      const getByIdSchema = SqlSchema.findOne({
        Request: Schema.String,
        Result: EnvironmentRow,
        execute: (id) =>
          sql`SELECT id, name, host, port, user, password, db_name, ssl, is_default, created_at FROM environments WHERE id = ${id} LIMIT 1`
      })
      const getById = (id: string): Effect.Effect<EnvironmentConfig | null> =>
        getByIdSchema(id).pipe(
          Effect.map(Option.map(toConfig)),
          Effect.map(Option.getOrNull),
          Effect.orDie,
          Effect.withSpan("EnvironmentRepository.getById")
        )

      const getByNameSchema = SqlSchema.findOne({
        Request: Schema.String,
        Result: EnvironmentRow,
        execute: (name) =>
          sql`SELECT id, name, host, port, user, password, db_name, ssl, is_default, created_at FROM environments WHERE name = ${name} LIMIT 1`
      })
      const getByName = (name: string): Effect.Effect<EnvironmentConfig | null> =>
        getByNameSchema(name).pipe(
          Effect.map(Option.map(toConfig)),
          Effect.map(Option.getOrNull),
          Effect.orDie,
          Effect.withSpan("EnvironmentRepository.getByName")
        )

      const getDefaultSchema = SqlSchema.findOne({
        Request: Schema.Void,
        Result: EnvironmentRow,
        execute: () =>
          sql`SELECT id, name, host, port, user, password, db_name, ssl, is_default, created_at FROM environments WHERE is_default = 1 LIMIT 1`
      })
      const getDefault = getDefaultSchema(undefined).pipe(
        Effect.map(Option.map(toConfig)),
        Effect.map(Option.getOrNull),
        Effect.orDie,
        Effect.withSpan("EnvironmentRepository.getDefault")
      )

      // -----------------------------------------------------------------------
      // Mutations
      // -----------------------------------------------------------------------

      const create = (input: EnvironmentCreateInput): Effect.Effect<EnvironmentConfig> =>
        Effect.gen(function*() {
          const id = crypto.randomUUID()
          const createdAt = new Date()
          const port = input.port ?? "5432"
          const ssl = input.ssl ?? false
          const isDefault = input.isDefault ?? false

          // If the new environment is marked as default, unset any existing
          // default first (equivalent to ON CONFLICT for a singleton flag).
          if (isDefault) {
            yield* sql`UPDATE environments SET is_default = 0 WHERE is_default = 1`
          }

          yield* sql`
            INSERT INTO environments (id, name, host, port, user, password, db_name, ssl, is_default, created_at)
            VALUES (${id}, ${input.name}, ${input.host}, ${port}, ${input.user}, ${input.password}, ${input.dbName}, ${
            ssl ? 1 : 0
          }, ${isDefault ? 1 : 0}, ${createdAt.toISOString()})
          `

          return new EnvironmentConfig({
            id,
            name: input.name,
            host: input.host,
            port,
            user: input.user,
            password: input.password,
            dbName: input.dbName,
            ssl,
            isDefault,
            createdAt
          })
        }).pipe(Effect.orDie, Effect.withSpan("EnvironmentRepository.create"))

      const update = (
        id: string,
        input: EnvironmentUpdateInput
      ): Effect.Effect<void> =>
        Effect.gen(function*() {
          // When promoting a different environment to default, unset the
          // current default first.
          if (input.isDefault === true) {
            yield* sql`UPDATE environments SET is_default = 0 WHERE is_default = 1 AND id != ${id}`
          }

          // Build a dynamic UPDATE – only the supplied fields are touched.
          const sets: Array<string> = []
          const params: Array<string | number> = []

          if (input.name !== undefined) {
            sets.push("name = ?")
            params.push(input.name)
          }
          if (input.host !== undefined) {
            sets.push("host = ?")
            params.push(input.host)
          }
          if (input.port !== undefined) {
            sets.push("port = ?")
            params.push(input.port)
          }
          if (input.user !== undefined) {
            sets.push("user = ?")
            params.push(input.user)
          }
          if (input.password !== undefined) {
            sets.push("password = ?")
            params.push(input.password)
          }
          if (input.dbName !== undefined) {
            sets.push("db_name = ?")
            params.push(input.dbName)
          }
          if (input.ssl !== undefined) {
            sets.push("ssl = ?")
            params.push(input.ssl ? 1 : 0)
          }
          if (input.isDefault !== undefined) {
            sets.push("is_default = ?")
            params.push(input.isDefault ? 1 : 0)
          }

          if (sets.length === 0) return

          params.push(id)
          yield* sql.unsafe(
            `UPDATE environments SET ${sets.join(", ")} WHERE id = ?`,
            params
          )
        }).pipe(Effect.orDie, Effect.withSpan("EnvironmentRepository.update"))

      const del = (id: string): Effect.Effect<void> =>
        Effect.gen(function*() {
          // Capture the current default *before* deleting.
          const deleted = yield* getById(id)

          yield* sql`DELETE FROM environments WHERE id = ${id}`

          // If the deleted environment was the default, assign the oldest
          // remaining environment as the new default.
          if (deleted?.isDefault) {
            const rows = yield* sql<{ readonly id: string }>`
              SELECT id FROM environments ORDER BY created_at ASC LIMIT 1
            `
            const nextId = rows[0]?.id
            if (nextId !== undefined) {
              yield* sql`UPDATE environments SET is_default = 1 WHERE id = ${nextId}`
            }
          }
        }).pipe(Effect.orDie, Effect.withSpan("EnvironmentRepository.delete"))

      return {
        list,
        getById,
        getByName,
        getDefault,
        create,
        update,
        delete: del
      } as const
    }),
    dependencies: [SqliteLive]
  }
) {}
