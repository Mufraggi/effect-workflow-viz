import { WorkflowReader } from "@template/database/repository/workflowReader/WorkflowReader"
import type { PageRequest } from "@template/domain/Pagination"
import type { ListRunsFilter } from "@template/domain/workflow/WorkflowReader"
import { Effect } from "effect"

export class ListRunsQuery extends Effect.Service<ListRunsQuery>()("ListRunsQuery", {
  effect: Effect.gen(function*() {
    const reader = yield* WorkflowReader
    return {
      execute: (filter: ListRunsFilter, page: PageRequest) => reader.listRuns(filter, page)
    } as const
  }),
  dependencies: [WorkflowReader.Default]
}) {}
