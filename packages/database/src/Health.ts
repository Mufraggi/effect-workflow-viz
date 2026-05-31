import { SqlClient } from "@effect/sql"
import { Duration, Effect } from "effect"

/**
 * Readiness probe for the workflow Postgres: a single `SELECT 1`, bounded by a
 * short timeout so a hung or saturated connection pool can't wedge the health
 * endpoint. Fails (rather than blocks) when the database is unreachable.
 *
 * Requires `SqlClient` in context — provided by `PgLive`.
 */
export const ping: Effect.Effect<void, unknown, SqlClient.SqlClient> = Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient
  yield* sql`SELECT 1`
}).pipe(
  Effect.timeout(Duration.seconds(2)),
  Effect.asVoid
)
