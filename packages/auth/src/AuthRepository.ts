import { SqlClient, SqlSchema } from "@effect/sql"
import { UserAlreadyExists } from "@template/domain/auth/AuthErrors"
import { AuthEvent } from "@template/domain/auth/AuthEvent"
import { Email } from "@template/domain/auth/Email"
import type { IpAddress } from "@template/domain/auth/IpAddress"
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

/** Admin user-list row, including the last successful login. */
export const AdminUser = Schema.Struct({
  id: UserId,
  email: Email,
  role: Role,
  createdAt: Schema.DateFromString,
  lastLoginAt: Schema.NullOr(Schema.DateFromString)
})
export type AdminUser = typeof AdminUser.Type

/** One audit-log entry (joined to the actor's email when still present). */
export const AuditEntry = Schema.Struct({
  event: AuthEvent,
  email: Schema.NullOr(Schema.String),
  ipAddress: Schema.NullOr(Schema.String),
  createdAt: Schema.DateFromString
})
export type AuditEntry = typeof AuditEntry.Type

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
        created_at TEXT NOT NULL,
        last_login_at TEXT
      )
    `
    // Bring forward any users table created before last_login_at existed.
    yield* sql`ALTER TABLE users ADD COLUMN last_login_at TEXT`.pipe(Effect.ignore)

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
        email TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL
      )
    `
    yield* sql`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at)`

    // Environments table — shared by AuthRepository and EnvironmentRepository.
    // Created here so the environments package does not need to duplicate the
    // DDL and so the table always exists even when EnvironmentRepository is
    // not invoked during a session (e.g. first-run setup).
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

    const countUsers = Effect.gen(function*() {
      const rows = yield* sql<{ readonly count: number }>`SELECT COUNT(*) AS count FROM users`
      return Number(rows[0]?.count ?? 0)
    }).pipe(Effect.orDie, Effect.withSpan("AuthRepository.countUsers"))

    const listUsersSchema = SqlSchema.findAll({
      Request: Schema.Void,
      Result: AdminUser,
      execute: () => sql`SELECT id, email, role, created_at, last_login_at FROM users ORDER BY created_at ASC`
    })
    const listUsers = listUsersSchema(undefined).pipe(
      Effect.orDie,
      Effect.withSpan("AuthRepository.listUsers")
    )

    const countAdmins = Effect.gen(function*() {
      const rows = yield* sql<{ readonly count: number }>`SELECT COUNT(*) AS count FROM users WHERE role = 'admin'`
      return Number(rows[0]?.count ?? 0)
    }).pipe(Effect.orDie, Effect.withSpan("AuthRepository.countAdmins"))

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

    const updateUser = (
      input: { readonly id: UserId; readonly role?: Role; readonly passwordHash?: string }
    ): Effect.Effect<void> =>
      Effect.gen(function*() {
        if (input.role !== undefined) {
          yield* sql`UPDATE users SET role = ${input.role} WHERE id = ${input.id}`
        }
        if (input.passwordHash !== undefined) {
          yield* sql`UPDATE users SET password_hash = ${input.passwordHash} WHERE id = ${input.id}`
        }
      }).pipe(Effect.orDie, Effect.asVoid, Effect.withSpan("AuthRepository.updateUser"))

    const deleteUser = (id: UserId): Effect.Effect<void> =>
      sql`DELETE FROM users WHERE id = ${id}`.pipe(
        Effect.orDie,
        Effect.asVoid,
        Effect.withSpan("AuthRepository.deleteUser")
      )

    const touchLastLogin = (id: UserId): Effect.Effect<void> =>
      sql`UPDATE users SET last_login_at = ${new Date().toISOString()} WHERE id = ${id}`.pipe(
        Effect.orDie,
        Effect.asVoid,
        Effect.withSpan("AuthRepository.touchLastLogin")
      )

    const recordLoginAttempt = (
      params: { readonly ip: IpAddress; readonly succeeded: boolean }
    ): Effect.Effect<void> =>
      sql`
        INSERT INTO login_attempts (ip_address, attempted_at, succeeded)
        VALUES (${params.ip}, ${Date.now()}, ${params.succeeded ? 1 : 0})
      `.pipe(Effect.orDie, Effect.asVoid, Effect.withSpan("AuthRepository.recordLoginAttempt"))

    const countRecentFailures = (
      params: { readonly ip: IpAddress; readonly windowMinutes: number }
    ): Effect.Effect<number> => {
      const since = Date.now() - params.windowMinutes * 60_000
      return Effect.gen(function*() {
        const rows = yield* sql<{ readonly count: number }>`
          SELECT COUNT(*) AS count FROM login_attempts
          WHERE ip_address = ${params.ip} AND attempted_at > ${since} AND succeeded = 0
        `
        return Number(rows[0]?.count ?? 0)
      }).pipe(Effect.orDie, Effect.withSpan("AuthRepository.countRecentFailures"))
    }

    const recordAudit = (params: {
      readonly event: AuthEvent
      readonly userId?: UserId | null
      readonly email?: string | null
      readonly ip?: IpAddress | null
      readonly userAgent?: string | null
    }): Effect.Effect<void> =>
      sql`
        INSERT INTO audit_log (id, event, user_id, email, ip_address, user_agent, created_at)
        VALUES (
          ${crypto.randomUUID()}, ${params.event}, ${params.userId ?? null}, ${params.email ?? null},
          ${params.ip ?? null}, ${params.userAgent ?? null}, ${new Date().toISOString()}
        )
      `.pipe(Effect.orDie, Effect.asVoid, Effect.withSpan("AuthRepository.recordAudit"))

    const listRecentAuditSchema = SqlSchema.findAll({
      Request: Schema.Number,
      Result: AuditEntry,
      execute: (limit) =>
        sql`SELECT event, email, ip_address, created_at FROM audit_log ORDER BY created_at DESC LIMIT ${limit}`
    })
    const listRecentAudit = (limit: number): Effect.Effect<ReadonlyArray<AuditEntry>> =>
      listRecentAuditSchema(limit).pipe(Effect.orDie, Effect.withSpan("AuthRepository.listRecentAudit"))

    const listRecentAuditByUserSchema = SqlSchema.findAll({
      Request: Schema.Tuple(UserId, Schema.Number),
      Result: AuditEntry,
      execute: ([userId, limit]) =>
        sql`SELECT event, email, ip_address, created_at FROM audit_log WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}`
    })
    const listRecentAuditByUser = (userId: UserId, limit: number): Effect.Effect<ReadonlyArray<AuditEntry>> =>
      listRecentAuditByUserSchema([userId, limit]).pipe(
        Effect.orDie,
        Effect.withSpan("AuthRepository.listRecentAuditByUser")
      )

    return {
      countUsers,
      countAdmins,
      listUsers,
      findByEmail,
      findById,
      createUser,
      updateUser,
      deleteUser,
      touchLastLogin,
      recordLoginAttempt,
      countRecentFailures,
      recordAudit,
      listRecentAudit,
      listRecentAuditByUser
    } as const
  }),
  dependencies: [SqliteLive]
}) {}
