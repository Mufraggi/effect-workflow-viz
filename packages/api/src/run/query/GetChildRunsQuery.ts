import { WorkflowReader } from "@template/database/repository/workflowReader/WorkflowReader"
import type { MessageId } from "@template/domain/run/MessageId"
import type { TraceId } from "@template/domain/run/TraceId"
import { Effect } from "effect"

export class GetChildRunsQuery extends Effect.Service<GetChildRunsQuery>()("GetChildRunsQuery", {
  effect: Effect.gen(function*() {
    const reader = yield* WorkflowReader
    return {
      execute: (traceId: TraceId, parentMessageId: MessageId) => reader.getChildRuns(traceId, parentMessageId)
    } as const
  }),
  dependencies: [WorkflowReader.Default]
}) {}
