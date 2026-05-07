import { Schema } from "effect"

export class RunNotFound extends Schema.TaggedError<RunNotFound>()(
  "RunNotFound",
  { runId: Schema.String }
) {}
