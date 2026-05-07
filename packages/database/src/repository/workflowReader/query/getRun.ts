import type { SqlClient } from "@effect/sql"
import type { SqlError } from "@effect/sql/SqlError"
import type { Effect } from "effect"
import type { RunDetailRow } from "../../../model/rowSchemas.js"

export const getRun = (
  sql: SqlClient.SqlClient,
  runId: bigint
): Effect.Effect<ReadonlyArray<RunDetailRow>, SqlError> =>
  sql<RunDetailRow>`
    SELECT
      m.id,
      m.entity_type,
      m.entity_id,
      m.shard_id,
      m.trace_id,
      m.processed,
      m.last_read,
      m.payload AS message_payload,
      m.headers,
      r.kind AS reply_kind,
      r.payload AS reply_payload
    FROM cluster_messages m
    LEFT JOIN cluster_replies r ON r.id = m.last_reply_id
    WHERE m.entity_type LIKE 'Workflow/%'
      AND m.kind = 0
      AND m.id = ${runId}
    LIMIT 1
  `
