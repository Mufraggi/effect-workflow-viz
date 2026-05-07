import { Schema } from "effect"
import { RunSummary } from "./RunSummary.js"

export class RunDetail extends Schema.Class<RunDetail>("RunDetail")({
  ...RunSummary.fields,
  input: Schema.NullOr(Schema.Unknown),
  output: Schema.NullOr(Schema.Unknown),
  children: Schema.Array(RunSummary)
}) {}
