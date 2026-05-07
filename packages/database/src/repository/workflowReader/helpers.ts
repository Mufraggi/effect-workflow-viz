import type { MessageId } from "@template/domain/run/MessageId"
import type { RunId } from "@template/domain/run/RunId"
import { RunSummary } from "@template/domain/run/RunSummary"
import type { ShardId } from "@template/domain/run/ShardId"
import type { TraceId } from "@template/domain/run/TraceId"
import * as Decode from "@template/domain/workflow/decode/index"
import type { WorkflowName } from "@template/domain/workflow/WorkflowName"
import type { RunListingRow } from "../../model/rowSchemas.js"

export const parseTimestamp = (value: string | null): Date | null => {
  if (value === null) return null
  const withT = value.includes("T") ? value : value.replace(" ", "T")
  const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/.test(withT)
  return new Date(hasOffset ? withT : `${withT}Z`)
}

export const stripWorkflowPrefix = (entityType: string): WorkflowName =>
  (entityType.startsWith("Workflow/")
    ? entityType.slice("Workflow/".length)
    : entityType) as WorkflowName

export const tryParseJson = (raw: string | null): unknown | null => {
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const safeBigInt = (s: string): bigint | null => {
  try {
    return BigInt(s)
  } catch {
    return null
  }
}

export const rowToSummary = (row: RunListingRow, now: Date): RunSummary => {
  const lastRead = parseTimestamp(row.lastRead)
  return new RunSummary({
    id: row.id as MessageId,
    workflowName: stripWorkflowPrefix(row.entityType),
    runId: row.entityId as RunId,
    shardId: row.shardId as ShardId,
    traceId: row.traceId as TraceId | null,
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
