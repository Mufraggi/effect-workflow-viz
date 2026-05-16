import { SqlClient } from "@effect/sql"
import { Effect } from "effect"
import { AuthDb, AuthDbLive } from "../db/AuthDb.js"
import type { IpAddress } from "../domain/IpAddress.js"

export class LoginAttemptRepository extends Effect.Service<LoginAttemptRepository>()("@app/LoginAttemptRepository", {
  effect: Effect.gen(function*() {
    const sql = yield* AuthDb

    const record = (params: { ipAddress: IpAddress; succeeded: boolean }): Effect.Effect<void> =>
      sql`
        INSERT INTO login_attempts (ip_address, attempted_at, succeeded)
        VALUES (${params.ipAddress}, ${Date.now()}, ${params.succeeded ? 1 : 0})
      `.pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.asVoid,
        Effect.orDie
      )

    const countRecentFailures = (params: {
      ipAddress: IpAddress
      windowMinutes: number
    }): Effect.Effect<number> => {
      const since = Date.now() - params.windowMinutes * 60 * 1000
      return sql`
        SELECT count(*) as count FROM login_attempts
        WHERE ip_address = ${params.ipAddress}
          AND attempted_at > ${since}
          AND succeeded = 0
      `.pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.map((rows) => {
          const row = rows[0] as { count: number } | undefined
          return row?.count ?? 0
        }),
        Effect.orDie
      )
    }

    return { record, countRecentFailures } as const
  }),
  dependencies: [AuthDbLive]
}) {}
