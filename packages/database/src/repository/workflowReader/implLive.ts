import { SqlClient } from "@effect/sql"
import { RunNotFound } from "@template/domain/run/errors"
import { RunDetail } from "@template/domain/run/RunDetail"
import { RunSummary } from "@template/domain/run/RunSummary"
import * as Decode from "@template/domain/workflow/decode/index"
import {
  type PaginatedRunSummary,
  WorkflowReader,
  type WorkflowReaderImpl
} from "@template/domain/workflow/WorkflowReader"
import { Effect, Layer, Schema } from "effect"
import { RunDetailRow, RunListingRow } from "../../model/rowSchemas.js"
import { getChildRuns } from "./query/getChildRuns.js"
import { getRun } from "./query/getRun.js"
import { listRuns } from "./query/listRuns.js"

const decodeListingRows = Schema.decodeUnknownSync(Schema.Array(RunListingRow))
const decodeDetailRows = Schema.decodeUnknownSync(Schema.Array(RunDetailRow))

const parseTimestamp = (value: string | null): Date | null => {
  if (value === null) return null
  const withT = value.includes("T") ? value : value.replace(" ", "T")
  const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/.test(withT)
  return new Date(hasOffset ? withT : `${withT}Z`)
}

const stripWorkflowPrefix = (entityType: string): string =>
  entityType.startsWith("Workflow/") ? entityType.slice("Workflow/".length) : entityType

const tryParseJson = (raw: string | null): unknown | null => {
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const rowToSummary = (row: RunListingRow, now: Date): RunSummary => {
  const lastRead = parseTimestamp(row.lastRead)
  return new RunSummary({
    id: row.id,
    workflowName: stripWorkflowPrefix(row.entityType),
    runId: row.entityId,
    shardId: row.shardId,
    traceId: row.traceId,
    startedAtProxy: lastRead,
    status: Decode.decodeRunStatus({
      processed: row.processed,
      lastRead,
      replyKind: row.replyKind,
      replyPayload: row.replyPayload,
      isWorkflow: row.entityType.startsWith("Workflow/"),
      now
    })
  })
}

const safeBigInt = (s: string): bigint | null => {
  try {
    return BigInt(s)
  } catch {
    return null
  }
}

const make = Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient

  const getChildRunsImpl: WorkflowReaderImpl["getChildRuns"] = (traceId, parentRunId) =>
    Effect.gen(function*() {
      const parsedParent = safeBigInt(parentRunId)
      if (parsedParent === null) return [] as ReadonlyArray<RunSummary>
      const now = new Date()
      const rawRows = yield* getChildRuns(sql, traceId, parsedParent)
      const rows = decodeListingRows(rawRows)
      return rows.map((r) => rowToSummary(r, now))
    }).pipe(Effect.orDie)

  const listRunsImpl: WorkflowReaderImpl["listRuns"] = (filter, page) =>
    Effect.gen(function*() {
      const now = new Date()
      const before = page.before === null ? null : safeBigInt(page.before)
      const statusFilter = filter.status && filter.status.length > 0
        ? new Set(filter.status)
        : null
      const fetchLimit = statusFilter === null ? page.limit : page.limit * 4

      const rawRows = yield* listRuns(sql, {
        limit: fetchLimit,
        before,
        workflowName: filter.workflowName ?? null,
        traceId: filter.traceId ?? null
      })
      const rows = decodeListingRows(rawRows)
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
    }).pipe(Effect.orDie)

  const getRunImpl: WorkflowReaderImpl["getRun"] = (runId) =>
    Effect.gen(function*() {
      const parsedId = safeBigInt(runId)
      if (parsedId === null) {
        return yield* Effect.fail(new RunNotFound({ runId }))
      }

      const rawRows = yield* getRun(sql, parsedId).pipe(Effect.orDie)
      const rows = decodeDetailRows(rawRows)
      if (rows.length === 0) {
        return yield* Effect.fail(new RunNotFound({ runId }))
      }

      const row = rows[0]!
      const now = new Date()
      const summary = rowToSummary(row, now)
      const input = tryParseJson(row.messagePayload)
      const output = row.replyKind === 0 ? tryParseJson(row.replyPayload) : null
      const children = row.traceId === null
        ? ([] as ReadonlyArray<RunSummary>)
        : yield* getChildRunsImpl(row.traceId, runId)

      return new RunDetail({
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
      })
    })

  const impl: WorkflowReaderImpl = {
    listRuns: listRunsImpl,
    getRun: getRunImpl,
    getChildRuns: getChildRunsImpl
  }
  return impl
})

export const WorkflowReaderLive = Layer.effect(WorkflowReader, make)
