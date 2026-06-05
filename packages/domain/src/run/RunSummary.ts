import { Schema } from "effect"
import { WorkflowName } from "../workflow/WorkflowName.js"
import { MessageId } from "./MessageId.js"
import { RunId } from "./RunId.js"
import { RunStatus } from "./RunStatus.js"
import { ShardId } from "./ShardId.js"
import { TraceId } from "./TraceId.js"

export class RunSummary extends Schema.Class<RunSummary>("RunSummary")({
  id: MessageId,
  workflowName: WorkflowName,
  runId: RunId,
  shardId: ShardId,
  traceId: Schema.NullOr(TraceId),
  // Run start, from the real `last_read` timestamp. Encodes to an ISO string.
  startedAt: Schema.NullOr(Schema.DateFromString),
  // Approximate wall-clock duration in ms, derived from Snowflake ids
  // (reply-id timestamp − message-id timestamp). Null when there is no reply
  // yet, or when ids aren't Snowflakes / clock skew makes the delta non-positive.
  durationMs: Schema.NullOr(Schema.Number),
  status: RunStatus
}) {}
