import type { SqlClient } from "@effect/sql"
import type { SqlError } from "@effect/sql/SqlError"
import type { Effect } from "effect"
import type { RunListingRow } from "../../../model/rowSchemas.js"

export interface ListRunsArgs {
  readonly limit: number
  readonly before: bigint | null
  readonly workflowName: string | null
  readonly traceId: string | null
}

export const listRuns = (
  sql: SqlClient.SqlClient,
  args: ListRunsArgs
): Effect.Effect<ReadonlyArray<RunListingRow>, SqlError> => {
  const beforeClause = args.before !== null
    ? sql`AND m.id < ${args.before}`
    : sql``
  const workflowClause = args.workflowName !== null
    ? sql`AND m.entity_type LIKE ${`Workflow/${args.workflowName}%`}`
    : sql``
  const traceClause = args.traceId !== null
    ? sql`AND m.trace_id = ${args.traceId}`
    : sql``

  return sql<RunListingRow>`
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
      ${beforeClause}
      ${workflowClause}
      ${traceClause}
    ORDER BY m.id DESC
    LIMIT ${args.limit}
  `
}
