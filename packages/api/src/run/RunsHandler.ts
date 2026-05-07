import { HttpApiBuilder } from "@effect/platform"
import { Api } from "@template/api-contract/Api"
import { PageRequest } from "@template/domain/Pagination"
import { Effect, Layer } from "effect"
import { GetChildRunsQuery } from "./query/GetChildRunsQuery.js"
import { GetRunQuery } from "./query/GetRunQuery.js"
import { ListRunsQuery } from "./query/ListRunsQuery.js"

export const RunsLive = HttpApiBuilder.group(Api, "runs", (handlers) =>
  Effect.gen(function*() {
    const listRuns = yield* ListRunsQuery
    const getRun = yield* GetRunQuery
    const getChildRuns = yield* GetChildRunsQuery
    return handlers
      .handle("listRuns", ({ urlParams }) =>
        listRuns.execute(
          {
            ...(urlParams.status !== undefined ? { status: urlParams.status } : {}),
            ...(urlParams.workflowName !== undefined ? { workflowName: urlParams.workflowName } : {}),
            ...(urlParams.traceId !== undefined ? { traceId: urlParams.traceId } : {})
          },
          new PageRequest({
            limit: urlParams.limit ?? 50,
            before: urlParams.before ?? null
          })
        ))
      .handle("getRun", ({ path }) => getRun.execute(path.messageId))
      .handle("getChildRuns", ({ path }) =>
        Effect.gen(function*() {
          const run = yield* getRun.execute(path.messageId)
          if (run.traceId === null) return []
          return yield* getChildRuns.execute(run.traceId, path.messageId)
        }))
  })).pipe(
    Layer.provide(ListRunsQuery.Default),
    Layer.provide(GetRunQuery.Default),
    Layer.provide(GetChildRunsQuery.Default)
  )
