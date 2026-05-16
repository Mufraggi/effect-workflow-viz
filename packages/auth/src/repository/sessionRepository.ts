import { SqlClient, SqlSchema } from "@effect/sql"
import { Effect, Option, Schema } from "effect"
import { alphabet, generateRandomString } from "oslo/crypto"
import { AuthDb, AuthDbLive } from "../db/AuthDb.js"
import type { AuthUserId } from "../domain/AuthUserId.js"
import type { IpAddress } from "../domain/IpAddress.js"
import { Session } from "../domain/Session.js"
import type { SessionId } from "../domain/SessionId.js"
import type { TokenHash } from "../domain/TokenHash.js"
import { SessionRow } from "../model/rowSchemas.js"

const rowToSession = (row: SessionRow): Session =>
  new Session({
    id: row.id,
    userId: row.userId,
    expiresAt: new Date(row.expiresAt),
    lastUsedAt: new Date(row.lastUsedAt),
    userAgent: row.userAgent,
    ipAddress: row.ipAddress
  })

export class SessionRepository extends Effect.Service<SessionRepository>()("@app/SessionRepository", {
  effect: Effect.gen(function*() {
    const sql = yield* AuthDb

    const findByTokenHashSchema = SqlSchema.findOne({
      Request: Schema.String,
      Result: SessionRow,
      execute: (tokenHash: string) =>
        sql`SELECT id, token_hash, user_id, created_at, expires_at, last_used_at, user_agent, ip_address FROM sessions WHERE token_hash = ${tokenHash}`
    })

    const listActiveSchema = SqlSchema.findAll({
      Request: Schema.String,
      Result: SessionRow,
      execute: (userId: string) =>
        sql`SELECT id, token_hash, user_id, created_at, expires_at, last_used_at, user_agent, ip_address FROM sessions WHERE user_id = ${userId} AND expires_at > ${Date.now()}`
    })

    const create = (params: {
      tokenHash: TokenHash
      userId: AuthUserId
      expiresAt: Date
      userAgent: string | null
      ipAddress: IpAddress | null
    }): Effect.Effect<Session> => {
      const id = generateRandomString(16, alphabet("a-z", "0-9")) as SessionId
      const now = Date.now()
      return sql`
        INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at, last_used_at, user_agent, ip_address)
        VALUES (${id}, ${params.tokenHash}, ${params.userId}, ${now}, ${params.expiresAt.getTime()}, ${now}, ${params.userAgent}, ${params.ipAddress})
      `.pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.map(() =>
          new Session({
            id,
            userId: params.userId,
            expiresAt: params.expiresAt,
            lastUsedAt: new Date(now),
            userAgent: params.userAgent,
            ipAddress: params.ipAddress
          })
        ),
        Effect.orDie
      )
    }

    const findByTokenHash = (tokenHash: TokenHash): Effect.Effect<Option.Option<Session>> =>
      findByTokenHashSchema(tokenHash).pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.map(Option.map(rowToSession)),
        Effect.orDie
      )

    const touch = (sessionId: SessionId, newExpiresAt: Date): Effect.Effect<void> =>
      sql`
        UPDATE sessions SET last_used_at = ${Date.now()}, expires_at = ${newExpiresAt.getTime()}
        WHERE id = ${sessionId}
      `.pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.asVoid,
        Effect.orDie
      )

    const deleteSession = (sessionId: SessionId): Effect.Effect<void> =>
      sql`DELETE FROM sessions WHERE id = ${sessionId}`.pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.asVoid,
        Effect.orDie
      )

    const deleteAllForUser = (userId: AuthUserId): Effect.Effect<void> =>
      sql`DELETE FROM sessions WHERE user_id = ${userId}`.pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.asVoid,
        Effect.orDie
      )

    const deleteExpired = (): Effect.Effect<number> =>
      Effect.gen(function*() {
        yield* sql`DELETE FROM sessions WHERE expires_at < ${Date.now()}`.pipe(
          Effect.provideService(SqlClient.SqlClient, sql)
        )
        const rows = yield* sql`SELECT changes() as count`.pipe(
          Effect.provideService(SqlClient.SqlClient, sql)
        )
        const row = rows[0] as { count: number } | undefined
        return row?.count ?? 0
      }).pipe(Effect.orDie)

    const listActiveForUser = (userId: AuthUserId): Effect.Effect<ReadonlyArray<Session>> =>
      listActiveSchema(userId).pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.map((rows) => rows.map(rowToSession)),
        Effect.orDie
      )

    return {
      create,
      findByTokenHash,
      touch,
      delete: deleteSession,
      deleteAllForUser,
      deleteExpired,
      listActiveForUser
    } as const
  }),
  dependencies: [AuthDbLive]
}) {}
