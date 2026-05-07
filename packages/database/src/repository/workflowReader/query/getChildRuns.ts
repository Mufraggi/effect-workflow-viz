import type { SqlClient } from "@effect/sql"
import type { SqlError } from "@effect/sql/SqlError"
import type { Effect } from "effect"
import type { RunListingRow } from "../../../model/rowSchemas.js"

export const getChildRuns = (
  sql: SqlClient.SqlClient,
  traceId: string,
  parentRunId: bigint
): Effect.Effect<ReadonlyArray<RunListingRow>, SqlError> =>
  sql<RunListingRow>`
    SELECT
      m.id,
      m.entity_type,
      m.entity_id,
      m.shard_id,
      m.trace_id,
      m.processed,
      m.last_read,
      r.kind AS reply_kind,
      r.payload AS reply_payload
    FROM cluster_messages m
    LEFT JOIN cluster_replies r ON r.id = m.last_reply_id
    WHERE m.entity_type LIKE 'Workflow/%'
      AND m.kind = 0
      AND m.trace_id = ${traceId}
      AND m.id <> ${parentRunId}
    ORDER BY m.id DESC
  `
