import { Context, type Effect } from "effect"
import type { PageRequest } from "../Pagination.js"
import type { RunNotFound } from "../run/errors.js"
import type { RunDetail } from "../run/RunDetail.js"
import type { RunStatus } from "../run/RunStatus.js"
import type { RunSummary } from "../run/RunSummary.js"

export interface PaginatedRunSummary {
  readonly items: ReadonlyArray<RunSummary>
  readonly nextCursor: string | null
}

export interface ListRunsFilter {
  readonly status?: ReadonlyArray<RunStatus>
  readonly workflowName?: string
  readonly traceId?: string
}

export interface WorkflowReaderImpl {
  readonly listRuns: (
    filter: ListRunsFilter,
    page: PageRequest
  ) => Effect.Effect<PaginatedRunSummary>

  readonly getRun: (runId: string) => Effect.Effect<RunDetail, RunNotFound>

  readonly getChildRuns: (
    traceId: string,
    parentRunId: string
  ) => Effect.Effect<ReadonlyArray<RunSummary>>
}

export class WorkflowReader extends Context.Tag("@template/WorkflowReader")<
  WorkflowReader,
  WorkflowReaderImpl
>() {}
