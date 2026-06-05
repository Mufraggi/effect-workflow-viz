import { WorkflowReader } from "@template/database/repository/workflowReader/WorkflowReader"
import { RunNotFound } from "@template/domain/run/errors"
import type { MessageId } from "@template/domain/run/MessageId"
import type { RunDetail } from "@template/domain/run/RunDetail"
import { RunSummary } from "@template/domain/run/RunSummary"
import type { TraceId } from "@template/domain/run/TraceId"
import { Effect, Layer } from "effect"

const toSummary = (d: RunDetail): RunSummary =>
  new RunSummary({
    id: d.id,
    workflowName: d.workflowName,
    runId: d.runId,
    shardId: d.shardId,
    traceId: d.traceId,
    startedAt: d.startedAt,
    durationMs: d.durationMs,
    status: d.status
  })

type ReaderImpl = {
  readonly listRuns: typeof WorkflowReader.Service.listRuns
  readonly getRun: typeof WorkflowReader.Service.getRun
  readonly getChildRuns: typeof WorkflowReader.Service.getChildRuns
}

export const makeInMemoryWorkflowReader = (
  details: ReadonlyArray<RunDetail>
): ReaderImpl => ({
  listRuns: (filter, page) =>
    Effect.sync(() => {
      let pool: ReadonlyArray<RunDetail> = details
      if (filter.workflowName !== undefined) {
        pool = pool.filter((r) => r.workflowName === filter.workflowName)
      }
      if (filter.traceId !== undefined) {
        pool = pool.filter((r) => r.traceId === filter.traceId)
      }
      if (filter.status !== undefined && filter.status.length > 0) {
        const allowed = new Set(filter.status)
        pool = pool.filter((r) => allowed.has(r.status))
      }
      const ordered = [...pool].sort((a, b) => (a.id < b.id ? 1 : -1))
      const after = page.before === null
        ? ordered
        : ordered.filter((r) => r.id < page.before!)
      const items = after.slice(0, page.limit).map(toSummary)
      const nextCursor = items.length === page.limit
        ? items[items.length - 1]!.id
        : null
      return { items, nextCursor }
    }),

  getRun: (messageId: MessageId) => {
    const found = details.find((r) => r.id === messageId)
    return found
      ? Effect.succeed(found)
      : Effect.fail(new RunNotFound({ runId: messageId }))
  },

  getChildRuns: (traceId: TraceId, parentMessageId: MessageId) =>
    Effect.sync(() =>
      details
        .filter((r) => r.traceId === traceId && r.id !== parentMessageId)
        .map(toSummary)
    )
})

export const InMemoryWorkflowReaderLive = (details: ReadonlyArray<RunDetail>) =>
  Layer.succeed(WorkflowReader, makeInMemoryWorkflowReader(details) as typeof WorkflowReader.Service)
