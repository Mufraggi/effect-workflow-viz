import { Schema } from "effect"

export const RunStatus = Schema.Literal(
  "pending",
  "running",
  "success",
  "failed_app",
  "crashed",
  "interrupted",
  "unknown"
)

export type RunStatus = typeof RunStatus.Type
