import { Schema } from "effect"
import { RunStatus } from "./RunStatus.js"

export class RunSummary extends Schema.Class<RunSummary>("RunSummary")({
  id: Schema.String,
  workflowName: Schema.String,
  runId: Schema.String,
  shardId: Schema.String,
  traceId: Schema.NullOr(Schema.String),
  startedAtProxy: Schema.NullOr(Schema.DateFromSelf),
  status: RunStatus
}) {}
