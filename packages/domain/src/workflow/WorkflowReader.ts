import type { RunStatus } from "../run/RunStatus.js"
import type { RunSummary } from "../run/RunSummary.js"
import type { TraceId } from "../run/TraceId.js"
import type { WorkflowName } from "./WorkflowName.js"

export interface PaginatedRunSummary {
  readonly items: ReadonlyArray<RunSummary>
  readonly nextCursor: string | null
}

export interface ListRunsFilter {
  readonly status?: ReadonlyArray<RunStatus>
  readonly workflowName?: WorkflowName
  readonly traceId?: TraceId
  // Inclusive lower / exclusive upper bound on the run start time. Applied as
  // bounds on the id column (ids are Snowflakes, see run/Snowflake).
  readonly from?: Date
  readonly to?: Date
}
