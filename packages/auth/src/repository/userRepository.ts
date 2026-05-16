import { SqlClient, SqlSchema } from "@effect/sql"
import { Effect, Option, Schema } from "effect"
import { alphabet, generateRandomString } from "oslo/crypto"
import { AuthDb, AuthDbLive } from "../db/AuthDb.js"
import type { AuthUserId } from "../domain/AuthUserId.js"
import type { Email } from "../domain/Email.js"
import { EmailAlreadyTaken } from "../domain/errors.js"
import type { PasswordHash } from "../domain/PasswordHash.js"
import { AuthUser } from "../domain/User.js"
import type { UserRole } from "../domain/UserRole.js"
import { UserRow } from "../model/rowSchemas.js"

type UserWithHash = AuthUser & { passwordHash: PasswordHash }

const rowToUser = (row: UserRow): AuthUser =>
  new AuthUser({
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: new Date(row.createdAt),
    lastLoginAt: row.lastLoginAt !== null ? new Date(row.lastLoginAt) : null
  })

export class UserRepository extends Effect.Service<UserRepository>()("@app/UserRepository", {
  effect: Effect.gen(function*() {
    const sql = yield* AuthDb

    const findByEmailSchema = SqlSchema.findOne({
      Request: Schema.String,
      Result: UserRow,
      execute: (email: string) =>
        sql`SELECT id, email, password_hash, role, created_at, last_login_at FROM users WHERE email = ${email}`
    })

    const findByIdSchema = SqlSchema.findOne({
      Request: Schema.String,
      Result: UserRow,
      execute: (id: string) =>
        sql`SELECT id, email, password_hash, role, created_at, last_login_at FROM users WHERE id = ${id}`
    })

    const create = (params: {
      email: Email
      passwordHash: PasswordHash
      role: UserRole
    }): Effect.Effect<AuthUser, EmailAlreadyTaken> => {
      const id = generateRandomString(16, alphabet("a-z", "0-9")) as AuthUserId
      const now = Date.now()
      return sql`
        INSERT INTO users (id, email, password_hash, role, created_at)
        VALUES (${id}, ${params.email}, ${params.passwordHash}, ${params.role}, ${now})
      `.pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.map(() =>
          new AuthUser({
            id,
            email: params.email,
            role: params.role,
            createdAt: new Date(now),
            lastLoginAt: null
          })
        ),
        Effect.catchTag("SqlError", (err) => {
          const causeMsg = err.cause instanceof Error ? err.cause.message : ""
          if (causeMsg.includes("UNIQUE constraint failed: users.email")) {
            return Effect.fail(new EmailAlreadyTaken({ email: params.email }))
          }
          return Effect.die(err)
        })
      )
    }

    const findByEmail = (email: Email): Effect.Effect<Option.Option<UserWithHash>> =>
      findByEmailSchema(email).pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.map(Option.map((row) => ({ ...rowToUser(row), passwordHash: row.passwordHash }))),
        Effect.orDie
      )

    const findById = (id: AuthUserId): Effect.Effect<Option.Option<AuthUser>> =>
      findByIdSchema(id).pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.map(Option.map(rowToUser)),
        Effect.orDie
      )

    const updateLastLogin = (userId: AuthUserId): Effect.Effect<void> =>
      sql`UPDATE users SET last_login_at = ${Date.now()} WHERE id = ${userId}`.pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.asVoid,
        Effect.orDie
      )

    const count = (): Effect.Effect<number> =>
      sql`SELECT count(*) as count FROM users`.pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.map((rows) => {
          const row = rows[0] as { count: number } | undefined
          return row?.count ?? 0
        }),
        Effect.orDie
      )

    return { create, findByEmail, findById, updateLastLogin, count } as const
  }),
  dependencies: [AuthDbLive]
}) {}
