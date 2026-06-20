import { Schema } from "effect"
import { RunSummary } from "./RunSummary.js"

export class RunDetail extends Schema.Class<RunDetail>("RunDetail")({
  ...RunSummary.fields,
  // The terminal reply id (cluster_messages.last_reply_id). Null while running.
  replyId: Schema.NullOr(Schema.String),
  input: Schema.NullOr(Schema.Unknown),
  output: Schema.NullOr(Schema.Unknown),
  children: Schema.Array(RunSummary)
}) {}
