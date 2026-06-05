import type { MessageId } from "@template/domain/run/MessageId"
import type { RunId } from "@template/domain/run/RunId"
import { RunSummary } from "@template/domain/run/RunSummary"
import type { ShardId } from "@template/domain/run/ShardId"
import { snowflakeToMillis } from "@template/domain/run/Snowflake"
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
  // Start time is the real `last_read` timestamp (robust for any id scheme).
  const lastRead = parseTimestamp(row.lastRead)
  const startedAt = lastRead
  const id = safeBigInt(row.id)
  const replyId = row.lastReplyId === null ? null : safeBigInt(row.lastReplyId)
  // Duration is the only Snowflake-derived value: reply-id ts − message-id ts.
  // Non-positive deltas (non-Snowflake ids / clock skew / no reply) → null.
  const rawDuration = id === null || replyId === null
    ? null
    : snowflakeToMillis(replyId) - snowflakeToMillis(id)
  const durationMs = rawDuration !== null && rawDuration > 0 ? rawDuration : null
  return new RunSummary({
    id: row.id as MessageId,
    workflowName: stripWorkflowPrefix(row.entityType),
    runId: row.entityId as RunId,
    shardId: row.shardId as ShardId,
    traceId: row.traceId as TraceId | null,
    startedAt,
    durationMs,
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
