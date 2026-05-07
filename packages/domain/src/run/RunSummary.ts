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
  startedAtProxy: Schema.NullOr(Schema.DateFromSelf),
  status: RunStatus
}) {}
