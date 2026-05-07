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

export class WorkflowReader extends Effect.Service<WorkflowReader>()("WorkflowReader", {
  effect: Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient

    const ListRunsRequest = Schema.Struct({
      limit: Schema.Number,
      before: Schema.NullOr(Schema.BigIntFromSelf),
      workflowName: Schema.NullOr(Schema.String),
      traceId: Schema.NullOr(Schema.String)
    })

    const listRunsSchema = SqlSchema.findAll({
      Request: ListRunsRequest,
      Result: RunListingRow,
      execute: ({ before, limit, traceId, workflowName }) => {
        const beforeClause = before !== null ? sql`AND m.id < ${before}` : sql``
        const workflowClause = workflowName !== null
          ? sql`AND m.entity_type LIKE ${`Workflow/${workflowName}%`}`
          : sql``
        const traceClause = traceId !== null ? sql`AND m.trace_id = ${traceId}` : sql``

        return sql`
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

      return pipe(
        listRunsSchema({
          limit: fetchLimit,
          before,
          workflowName: filter.workflowName ?? null,
          traceId: filter.traceId ?? null
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
          Effect.flatMap((row) => {
            const now = new Date()
            const summary = rowToSummary(row, now)
            const input = tryParseJson(row.messagePayload)
            const output = row.replyKind === 0 ? tryParseJson(row.replyPayload) : null
            const childrenEffect = row.traceId === null
              ? Effect.succeed([] as ReadonlyArray<RunSummary>)
              : getChildRuns(row.traceId as TraceId, messageId)
            return Effect.map(childrenEffect, (children) =>
              new RunDetail({
                id: summary.id,
                workflowName: summary.workflowName,
                runId: summary.runId,
                shardId: summary.shardId,
                traceId: summary.traceId,
                startedAtProxy: summary.startedAtProxy,
                status: summary.status,
                input,
                output,
                children
              }))
          })
        )
      return pipe(
        inner,
        Effect.withSpan("WorkflowReader.getRun", { attributes: { messageId } })
      )
    }

    return {
      listRuns,
      getRun,
      getChildRuns
    } as const
  }),
  dependencies: [PgLive]
}) {}
