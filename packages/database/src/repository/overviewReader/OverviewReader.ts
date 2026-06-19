import type { SqlClient } from "@effect/sql"
import { SqlSchema } from "@effect/sql"
import { Effect, Option, Schema } from "effect"

// ---------------------------------------------------------------------------
// Query result types (used by the web controller to build OverviewSnapshot)
// ---------------------------------------------------------------------------

export const WorkflowStatsResult = Schema.Struct({
  status: Schema.String,
  count: Schema.Number
})

export const ActivityRow = Schema.Struct({
  bucket: Schema.String,
  completed: Schema.Number,
  failed: Schema.Number
})

export const ShardCountRow = Schema.Struct({
  shardId: Schema.String,
  messageCount: Schema.Number
})

export const EntityTypeRow = Schema.Struct({
  entityType: Schema.String
})

export const CountResult = Schema.Struct({
  count: Schema.Number
})

// ---------------------------------------------------------------------------
// Factory — builds a stateless OverviewReader bound to a given SqlClient.
// ---------------------------------------------------------------------------
export const makeOverviewReader = (sql: SqlClient.SqlClient) => {
  // ── 1. Workflow counts by status ──────────────────────────────────────
  const workflowStatsSchema = SqlSchema.findAll({
    Request: Schema.Struct({}),
    Result: WorkflowStatsResult,
    execute: () =>
      sql`
      SELECT
        CASE
          WHEN m.last_reply_id IS NULL AND m.last_read IS NULL THEN 'pending'
          WHEN m.last_reply_id IS NULL AND m.last_read >= NOW() - INTERVAL '10 minutes' THEN 'running'
          WHEN m.last_reply_id IS NULL THEN 'pending'
          WHEN r.kind IS DISTINCT FROM 0 THEN 'unknown'
          ELSE COALESCE(
            CASE
              WHEN r.payload LIKE '%"Success"%' THEN 'success'
              WHEN r.payload LIKE '%"Fail"%' THEN 'failed_app'
              WHEN r.payload LIKE '%"Die"%' THEN 'crashed'
              WHEN r.payload LIKE '%"Interrupt"%' THEN 'interrupted'
              ELSE 'unknown'
            END,
            'unknown'
          )
        END AS status,
        COUNT(*)::int AS count
      FROM cluster_messages m
      LEFT JOIN cluster_replies r ON r.id = m.last_reply_id
      WHERE m.entity_type LIKE 'Workflow/%'
        AND m.kind = 0
      GROUP BY status
    `
  })

  // ── 2. Activity over the last N hours (15-min buckets) ────────────────
  const activitySchema = SqlSchema.findAll({
    Request: Schema.Struct({
      fromTs: Schema.String,
      toTs: Schema.String
    }),
    Result: ActivityRow,
    execute: ({ fromTs, toTs }) =>
      sql`
      WITH buckets AS (
        SELECT
          date_trunc('hour', m.last_read)
            + INTERVAL '15 minutes' * FLOOR(EXTRACT(MINUTE FROM m.last_read) / 15)
            AS bucket,
          r.payload
        FROM cluster_messages m
        LEFT JOIN cluster_replies r ON r.id = m.last_reply_id
        WHERE m.entity_type LIKE 'Workflow/%'
          AND m.kind = 0
          AND m.last_read >= ${fromTs}::timestamp
          AND m.last_read < ${toTs}::timestamp
      )
      SELECT
        to_char(bucket, 'YYYY-MM-DD HH24:MI:SS') AS bucket,
        COUNT(*) FILTER (WHERE payload LIKE '%"Success"%')::int AS completed,
        COUNT(*) FILTER (
          WHERE payload IS NOT NULL
            AND payload NOT LIKE '%"Success"%'
            AND payload NOT LIKE '"Success"'
        )::int AS failed
      FROM buckets
      GROUP BY bucket
      ORDER BY bucket ASC
    `
  })

  // ── 3. Shard distribution ────────────────────────────────────────────
  const shardCountsSchema = SqlSchema.findAll({
    Request: Schema.Struct({}),
    Result: ShardCountRow,
    execute: () =>
      sql`
      SELECT
        shard_id AS "shardId",
        COUNT(*)::int AS "messageCount"
      FROM cluster_messages
      WHERE entity_type LIKE 'Workflow/%'
        AND kind = 0
      GROUP BY shard_id
      ORDER BY shard_id
    `
  })

  // ── 4. Entity (workflow name) count ──────────────────────────────────
  const entityTypesSchema = SqlSchema.findAll({
    Request: Schema.Struct({}),
    Result: EntityTypeRow,
    execute: () =>
      sql`
      SELECT DISTINCT entity_type AS "entityType"
      FROM cluster_messages
      WHERE entity_type LIKE 'Workflow/%'
        AND kind = 0
    `
  })

  // ── 5. Recent message count (for throughput estimate) ────────────────
  const recentCountSchema = SqlSchema.findOne({
    Request: Schema.Struct({ since: Schema.String }),
    Result: CountResult,
    execute: ({ since }) =>
      sql`
      SELECT COUNT(*)::int AS count
      FROM cluster_messages
      WHERE entity_type LIKE 'Workflow/%'
        AND kind = 0
        AND last_read >= ${since}::timestamp
    `
  })

  return {
    workflowStatsSchema,
    activitySchema,
    shardCountsSchema,
    entityTypesSchema,
    recentCountSchema,
    buildSnapshot: () =>
      Effect.gen(function*() {
        const now = new Date()
        const toTs = now.toISOString().slice(0, 19).replace("T", " ")
        const fromTs = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          .toISOString().slice(0, 19).replace("T", " ")
        const sinceTs = new Date(now.getTime() - 60 * 60 * 1000)
          .toISOString().slice(0, 19).replace("T", " ")

        const [stats, activity, shardCounts, entityTypes, recentCount] = yield* Effect.all(
          [
            workflowStatsSchema({}),
            activitySchema({ fromTs, toTs }),
            shardCountsSchema({}),
            entityTypesSchema({}),
            recentCountSchema({ since: sinceTs })
          ],
          { concurrency: 4 }
        )

        return {
          stats,
          activity,
          shardCounts,
          entityTypes,
          recentCount: Option.isSome(recentCount) ? recentCount.value.count : 0,
          now
        }
      })
  } as const
}
