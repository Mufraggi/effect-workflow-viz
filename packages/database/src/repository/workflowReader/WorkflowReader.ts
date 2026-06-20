import { SqlClient, SqlSchema } from "@effect/sql"
import type { PageRequest } from "@template/domain/Pagination"
import { RunNotFound } from "@template/domain/run/errors"
import type { MessageId } from "@template/domain/run/MessageId"
import { RunDetail } from "@template/domain/run/RunDetail"
import type { RunSummary } from "@template/domain/run/RunSummary"
import type { TraceId } from "@template/domain/run/TraceId"
import type { ListRunsFilter, PaginatedRunSummary } from "@template/domain/workflow/WorkflowReader"
import { Effect, Option, pipe, Schema } from "effect"
import { RunDetailRow, RunListingRow } from "../../model/rowSchemas.js"
import { PgLive } from "../../PgLive.js"
import { rowToSummary, safeBigInt, tryParseJson } from "./helpers.js"

// ---------------------------------------------------------------------------
// Factory — builds a stateless WorkflowReader bound to a given SqlClient.
//
// Explicit dependency injection (the `sql` client is passed in rather than
// resolved from the environment) so callers can instantiate as many readers
// as they need, each pointing at a different connection:
//
//   const localReader   = makeWorkflowReader(localSql)
//   const replicaReader = makeWorkflowReader(replicaSql)
//
// This is what powers the dynamic, database-per-environment use case where the
// PgClient pool is created at runtime (see DbManager) rather than wired via
// PgLive. The `WorkflowReader` service below is just the env-var default path.
// ---------------------------------------------------------------------------
export const makeWorkflowReader = (sql: SqlClient.SqlClient) => {
  const ListRunsRequest = Schema.Struct({
    limit: Schema.Number,
    before: Schema.NullOr(Schema.BigIntFromSelf),
    workflowName: Schema.NullOr(Schema.String),
    traceId: Schema.NullOr(Schema.String),
    // Date-range bounds as UTC `YYYY-MM-DD HH:MM:SS` strings, compared against
    // the real `last_read` timestamp (robust regardless of the id scheme).
    fromTs: Schema.NullOr(Schema.String),
    toTs: Schema.NullOr(Schema.String)
  })

  const listRunsSchema = SqlSchema.findAll({
    Request: ListRunsRequest,
    Result: RunListingRow,
    execute: ({ before, fromTs, limit, toTs, traceId, workflowName }) => {
      const beforeClause = before !== null ? sql`AND m.id < ${before}` : sql``
      const workflowClause = workflowName !== null
        ? sql`AND m.entity_type LIKE ${`Workflow/${workflowName}%`}`
        : sql``
      const traceClause = traceId !== null ? sql`AND m.trace_id = ${traceId}` : sql``
      const fromClause = fromTs !== null ? sql`AND m.last_read >= ${fromTs}` : sql``
      const toClause = toTs !== null ? sql`AND m.last_read < ${toTs}` : sql``

      return sql`
        SELECT
          m.id,
          m.entity_type,
          m.entity_id,
          m.shard_id,
          m.trace_id,
          m.processed,
          m.last_read,
          m.last_reply_id,
          r.kind AS reply_kind,
          r.payload AS reply_payload
        FROM cluster_messages m
        LEFT JOIN cluster_replies r ON r.id = m.last_reply_id
        WHERE m.entity_type LIKE 'Workflow/%'
          AND m.kind = 0
          ${beforeClause}
          ${workflowClause}
          ${traceClause}
          ${fromClause}
          ${toClause}
        ORDER BY m.id DESC
        LIMIT ${limit}
      `
    }
  })

  const listRuns = (filter: ListRunsFilter, page: PageRequest) => {
    const before = page.before === null ? null : safeBigInt(page.before)
    const statusFilter = filter.status && filter.status.length > 0
      ? new Set(filter.status)
      : null
    const fetchLimit = statusFilter === null ? page.limit : page.limit * 4
    // last_read is stored as a naive UTC timestamp; format the bounds to match.
    const toUtcTs = (d: Date): string => d.toISOString().slice(0, 19).replace("T", " ")
    const fromTs = filter.from ? toUtcTs(filter.from) : null
    const toTs = filter.to ? toUtcTs(filter.to) : null

    return pipe(
      listRunsSchema({
        limit: fetchLimit,
        before,
        workflowName: filter.workflowName ?? null,
        traceId: filter.traceId ?? null,
        fromTs,
        toTs
      }),
      Effect.map((rows) => {
        const now = new Date()
        const summaries = rows.map((r) => rowToSummary(r, now))
        const filtered = statusFilter === null
          ? summaries
          : summaries.filter((s) => statusFilter.has(s.status))
        const items = filtered.slice(0, page.limit)
        const nextCursor = items.length === page.limit
          ? items[items.length - 1]!.id
          : null
        const result: PaginatedRunSummary = { items, nextCursor }
        return result
      }),
      Effect.orDie,
      Effect.withSpan("WorkflowReader.listRuns", {
        attributes: {
          "filter.workflowName": filter.workflowName ?? null,
          "filter.traceId": filter.traceId ?? null,
          "page.limit": page.limit
        }
      })
    )
  }

  const GetChildRunsRequest = Schema.Struct({
    traceId: Schema.String,
    parentMessageId: Schema.BigIntFromSelf
  })

  const getChildRunsSchema = SqlSchema.findAll({
    Request: GetChildRunsRequest,
    Result: RunListingRow,
    execute: ({ parentMessageId, traceId }) =>
      sql`
        SELECT
          m.id,
          m.entity_type,
          m.entity_id,
          m.shard_id,
          m.trace_id,
          m.processed,
          m.last_read,
          m.last_reply_id,
          r.kind AS reply_kind,
          r.payload AS reply_payload
        FROM cluster_messages m
        LEFT JOIN cluster_replies r ON r.id = m.last_reply_id
        WHERE m.entity_type LIKE 'Workflow/%'
          AND m.kind = 0
          AND m.trace_id = ${traceId}
          AND m.id <> ${parentMessageId}
        ORDER BY m.id DESC
      `
  })

  const getChildRuns = (traceId: TraceId, parentMessageId: MessageId) => {
    const parsedParent = safeBigInt(parentMessageId)
    if (parsedParent === null) {
      return Effect.succeed([] as ReadonlyArray<RunSummary>)
    }
    return pipe(
      getChildRunsSchema({ traceId, parentMessageId: parsedParent }),
      Effect.map((rows) => {
        const now = new Date()
        return rows.map((r) => rowToSummary(r, now))
      }),
      Effect.orDie,
      Effect.withSpan("WorkflowReader.getChildRuns", {
        attributes: { traceId, parentMessageId }
      })
    )
  }

  const getRunSchema = SqlSchema.findOne({
    Request: Schema.BigIntFromSelf,
    Result: RunDetailRow,
    execute: (id) =>
      sql`
        SELECT
          m.id,
          m.entity_type,
          m.entity_id,
          m.shard_id,
          m.trace_id,
          m.processed,
          m.last_read,
          m.last_reply_id,
          m.payload AS message_payload,
          m.headers,
          r.kind AS reply_kind,
          r.payload AS reply_payload
        FROM cluster_messages m
        LEFT JOIN cluster_replies r ON r.id = m.last_reply_id
        WHERE m.entity_type LIKE 'Workflow/%'
          AND m.kind = 0
          AND m.id = ${id}
        LIMIT 1
      `
  })

  // Build a full RunDetail from a fetched detail row. The message id is the
  // row's own id (a Snowflake), used both as the detail id and to exclude the
  // parent when listing sibling (child) runs sharing the trace.
  const rowToDetail = (row: RunDetailRow): Effect.Effect<RunDetail> => {
    const now = new Date()
    const summary = rowToSummary(row, now)
    const input = tryParseJson(row.messagePayload)
    const output = row.replyKind === 0 ? tryParseJson(row.replyPayload) : null
    const childrenEffect = row.traceId === null
      ? Effect.succeed([] as ReadonlyArray<RunSummary>)
      : getChildRuns(row.traceId as TraceId, summary.id)
    return Effect.map(childrenEffect, (children) =>
      new RunDetail({
        id: summary.id,
        workflowName: summary.workflowName,
        runId: summary.runId,
        shardId: summary.shardId,
        traceId: summary.traceId,
        startedAt: summary.startedAt,
        durationMs: summary.durationMs,
        status: summary.status,
        replyId: row.lastReplyId,
        input,
        output,
        children
      }))
  }

  const getRun = (messageId: MessageId): Effect.Effect<RunDetail, RunNotFound> => {
    const parsedId = safeBigInt(messageId)
    const inner = parsedId === null
      ? Effect.fail(new RunNotFound({ runId: messageId }))
      : pipe(
        getRunSchema(parsedId),
        Effect.orDie,
        Effect.flatMap((opt) =>
          Option.isNone(opt)
            ? Effect.fail(new RunNotFound({ runId: messageId }))
            : Effect.succeed(opt.value)
        ),
        Effect.flatMap(rowToDetail)
      )
    return pipe(
      inner,
      Effect.withSpan("WorkflowReader.getRun", { attributes: { messageId } })
    )
  }

  // Look up a run by its executionId (entity_id). entity_id is unique per
  // workflow execution; ORDER BY id DESC LIMIT 1 is a defensive tie-break.
  const getRunByExecutionIdSchema = SqlSchema.findOne({
    Request: Schema.String,
    Result: RunDetailRow,
    execute: (executionId) =>
      sql`
        SELECT
          m.id,
          m.entity_type,
          m.entity_id,
          m.shard_id,
          m.trace_id,
          m.processed,
          m.last_read,
          m.last_reply_id,
          m.payload AS message_payload,
          m.headers,
          r.kind AS reply_kind,
          r.payload AS reply_payload
        FROM cluster_messages m
        LEFT JOIN cluster_replies r ON r.id = m.last_reply_id
        WHERE m.entity_type LIKE 'Workflow/%'
          AND m.kind = 0
          AND m.entity_id = ${executionId}
        ORDER BY m.id DESC
        LIMIT 1
      `
  })

  const getRunByExecutionId = (executionId: string): Effect.Effect<RunDetail, RunNotFound> =>
    pipe(
      getRunByExecutionIdSchema(executionId),
      Effect.orDie,
      Effect.flatMap((opt) =>
        Option.isNone(opt)
          ? Effect.fail(new RunNotFound({ runId: executionId }))
          : Effect.succeed(opt.value)
      ),
      Effect.flatMap(rowToDetail),
      Effect.withSpan("WorkflowReader.getRunByExecutionId", { attributes: { executionId } })
    )

  return {
    listRuns,
    getRun,
    getRunByExecutionId,
    getChildRuns
  } as const
}

// ---------------------------------------------------------------------------
// Effect.Service — default singleton wired to PgLive (from env vars).
// Delegates to `makeWorkflowReader(sql)` so both paths share one implementation.
// ---------------------------------------------------------------------------
export class WorkflowReader extends Effect.Service<WorkflowReader>()("WorkflowReader", {
  effect: Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient
    return makeWorkflowReader(sql)
  }),
  dependencies: [PgLive]
}) {}
