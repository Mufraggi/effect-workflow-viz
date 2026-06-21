import { makeOverviewReader } from "@template/database/repository/overviewReader/OverviewReader"
import { makeWorkflowReader } from "@template/database/repository/workflowReader/WorkflowReader"
import { DbManager } from "@template/environments/DbManager"
import { Effect } from "effect"

/**
 * Thin helper that resolves an `envId` string to a ready-to-use
 * `WorkflowReader` or `OverviewReader` via `DbManager`.
 *
 * Both reader factories agree with the pattern used in the Remix loaders
 * (see packages/web/app/actions/controller.tsx).
 */
export class EnvReader extends Effect.Service<EnvReader>()("EnvReader", {
  effect: Effect.gen(function*() {
    const db = yield* DbManager

    return {
      getClient: (envId: string) => db.getClient(envId),

      getWorkflowReader: (envId: string) =>
        Effect.gen(function*() {
          const pg = yield* db.getClient(envId)
          return makeWorkflowReader(pg)
        }),

      getOverviewReader: (envId: string) =>
        Effect.gen(function*() {
          const pg = yield* db.getClient(envId)
          return makeOverviewReader(pg)
        })
    } as const
  }),
  dependencies: [DbManager.Default]
}) {}
