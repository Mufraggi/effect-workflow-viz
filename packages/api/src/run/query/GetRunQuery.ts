import { WorkflowReader } from "@template/database/repository/workflowReader/WorkflowReader"
import type { MessageId } from "@template/domain/run/MessageId"
import { Effect } from "effect"

export class GetRunQuery extends Effect.Service<GetRunQuery>()("GetRunQuery", {
  effect: Effect.gen(function*() {
    const reader = yield* WorkflowReader
    return {
      execute: (messageId: MessageId) => reader.getRun(messageId)
    } as const
  }),
  dependencies: [WorkflowReader.Default]
}) {}
