import { SqlClient, SqlSchema } from "@effect/sql"
import { Email } from "@template/domain/auth/Email"
import { UserAlreadyExists } from "@template/domain/auth/errors"
import { Role } from "@template/domain/auth/Role"
import { User } from "@template/domain/auth/User"
import { UserId } from "@template/domain/UserId"
import { Effect, Option, Schema } from "effect"
import * as crypto from "node:crypto"
import { SqliteLive } from "./SqliteLive.js"

/** Internal row shape carrying the password hash — never leaves this module. */
const UserWithHash = Schema.Struct({
  id: UserId,
  email: Email,
  role: Role,
  createdAt: Schema.DateFromString,
  passwordHash: Schema.String
})
export type UserWithHash = typeof UserWithHash.Type

/**
 * The auth repository. Mirrors the `WorkflowReader` service pattern but over the
 * writable SQLite layer. The `users` table is created idempotently on first use
 * (single table — no migration runner needed for v1).
 */
export class AuthRepository extends Effect.Service<AuthRepository>()("AuthRepository", {
  effect: Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient

    yield* sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `

    const countUsers = Effect.gen(function*() {
      const rows = yield* sql<{ readonly count: number }>`SELECT COUNT(*) AS count FROM users`
      return Number(rows[0]?.count ?? 0)
    }).pipe(Effect.orDie, Effect.withSpan("AuthRepository.countUsers"))

    const findByEmailSchema = SqlSchema.findOne({
      Request: Email,
      Result: UserWithHash,
      execute: (email) =>
        sql`SELECT id, email, password_hash, role, created_at FROM users WHERE email = ${email} LIMIT 1`
    })
    const findByEmail = (email: Email): Effect.Effect<UserWithHash | null> =>
      findByEmailSchema(email).pipe(
        Effect.map(Option.getOrNull),
        Effect.orDie,
        Effect.withSpan("AuthRepository.findByEmail")
      )

    const findByIdSchema = SqlSchema.findOne({
      Request: UserId,
      Result: User,
      execute: (id) => sql`SELECT id, email, role, created_at FROM users WHERE id = ${id} LIMIT 1`
    })
    const findById = (id: UserId): Effect.Effect<User | null> =>
      findByIdSchema(id).pipe(
        Effect.map(Option.getOrNull),
        Effect.orDie,
        Effect.withSpan("AuthRepository.findById")
      )

    const createUser = (
      input: { readonly email: Email; readonly passwordHash: string; readonly role: Role }
    ): Effect.Effect<User, UserAlreadyExists> =>
      Effect.gen(function*() {
        const id = UserId.make(crypto.randomUUID())
        const createdAt = new Date()
        yield* sql`
          INSERT INTO users (id, email, password_hash, role, created_at)
          VALUES (${id}, ${input.email}, ${input.passwordHash}, ${input.role}, ${createdAt.toISOString()})
        `
        return new User({ id, email: input.email, role: input.role, createdAt })
      }).pipe(
        Effect.catchTag("SqlError", (err) => {
          const text = `${err.message} ${String(err.cause ?? "")}`
          return text.includes("UNIQUE")
            ? Effect.fail(new UserAlreadyExists({ email: input.email }))
            : Effect.die(err)
        }),
        Effect.withSpan("AuthRepository.createUser")
      )

    return { countUsers, findByEmail, findById, createUser } as const
  }),
  dependencies: [SqliteLive]
}) {}
