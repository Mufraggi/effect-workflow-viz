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

export const ActiveRunnerRow = Schema.Struct({
  address: Schema.String,
  runner: Schema.String,
  healthy: Schema.Boolean,
  lastHeartbeat: Schema.String
})

export const ShardAssignmentRow = Schema.Struct({
  shardId: Schema.String,
  address: Schema.String,
  acquiredAt: Schema.String
})

export const MaxShardResult = Schema.Struct({
  maxShard: Schema.Number
})

export const ShardEntityRow = Schema.Struct({
  shardId: Schema.String,
  entityCount: Schema.Number
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

  // ── 5. Active cluster runners (heartbeat within lock expiration 35s) ──
  const activeRunnersSchema = SqlSchema.findAll({
    Request: Schema.Struct({}),
    Result: ActiveRunnerRow,
    execute: () =>
      sql`
      SELECT address, runner, healthy, last_heartbeat::text AS "lastHeartbeat"
      FROM cluster_runners
      WHERE last_heartbeat > NOW() - INTERVAL '35 seconds'
      ORDER BY address
    `
  })

  // ── 6. All runners (including stale) ─────────────────────────────────
  const allRunnersSchema = SqlSchema.findAll({
    Request: Schema.Struct({}),
    Result: ActiveRunnerRow,
    execute: () =>
      sql`
      SELECT address, runner, healthy, last_heartbeat::text AS "lastHeartbeat"
      FROM cluster_runners
      ORDER BY address
    `
  })

  // ── 7. Shard assignments from cluster_locks (non-expired) ────────────
  const shardAssignmentsSchema = SqlSchema.findAll({
    Request: Schema.Struct({}),
    Result: ShardAssignmentRow,
    execute: () =>
      sql`
      SELECT shard_id AS "shardId", address, acquired_at::text AS "acquiredAt"
      FROM cluster_locks
      WHERE acquired_at > NOW() - INTERVAL '35 seconds'
      ORDER BY shard_id
    `
  })

  // ── 8. Max shard number observed across locks and messages ───────────
  const maxShardSchema = SqlSchema.findOne({
    Request: Schema.Struct({}),
    Result: MaxShardResult,
    execute: () =>
      sql`
      SELECT COALESCE(MAX(CAST(SPLIT_PART(shard_id, ':', 2) AS INTEGER)), 0) AS "maxShard"
      FROM (
        SELECT shard_id FROM cluster_locks
        UNION
        SELECT shard_id FROM cluster_messages WHERE shard_id IS NOT NULL
      ) s
    `
  })

  // ── 9. Entities per shard (distinct entity_ids seen) ─────────────────
  const shardEntitiesSchema = SqlSchema.findAll({
    Request: Schema.Struct({}),
    Result: ShardEntityRow,
    execute: () =>
      sql`
      SELECT shard_id AS "shardId", COUNT(DISTINCT entity_id)::int AS "entityCount"
      FROM cluster_messages
      GROUP BY shard_id
      ORDER BY shard_id
    `
  })

  // ── 10. Recent message count (for throughput estimate) ────────────────
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
    activeRunnersSchema,
    allRunnersSchema,
    shardAssignmentsSchema,
    maxShardSchema,
    shardEntitiesSchema,
    recentCountSchema,
    buildSnapshot: () =>
      Effect.gen(function*() {
        const now = new Date()
        const toTs = now.toISOString().slice(0, 19).replace("T", " ")
        const fromTs = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          .toISOString().slice(0, 19).replace("T", " ")
        const sinceTs = new Date(now.getTime() - 60 * 60 * 1000)
          .toISOString().slice(0, 19).replace("T", " ")

        const [
          stats,
          activity,
          shardCounts,
          entityTypes,
          activeRunners,
          allRunners,
          shardAssignments,
          maxShardRaw,
          shardEntities,
          recentCount
        ] = yield* Effect.all(
          [
            workflowStatsSchema({}),
            activitySchema({ fromTs, toTs }),
            shardCountsSchema({}),
            entityTypesSchema({}),
            activeRunnersSchema({}),
            allRunnersSchema({}),
            shardAssignmentsSchema({}),
            maxShardSchema({}),
            shardEntitiesSchema({}),
            recentCountSchema({ since: sinceTs })
          ],
          { concurrency: 4 }
        )

        const maxShard = Option.isSome(maxShardRaw) ? maxShardRaw.value.maxShard : 0

        // Default ShardingConfig.shardsPerGroup = 300; use observed max or 300 minimum
        const SHARD_CONFIG_DEFAULT = 300
        const safeMaxShard = maxShard > 0 ? Math.max(maxShard, SHARD_CONFIG_DEFAULT) : SHARD_CONFIG_DEFAULT

        return {
          stats,
          activity,
          shardCounts,
          entityTypes,
          activeRunners,
          allRunners,
          shardAssignments,
          maxShard: safeMaxShard,
          shardEntities,
          recentCount: Option.isSome(recentCount) ? recentCount.value.count : 0,
          now
        }
      })
  } as const
}
