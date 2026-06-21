import { makeOverviewReader } from "@template/database/repository/overviewReader/OverviewReader"
import { makeWorkflowReader } from "@template/database/repository/workflowReader/WorkflowReader"
import { DbManager } from "@template/environments/DbManager"
import { EnvironmentRepository } from "@template/environments/EnvironmentRepository"
import { Effect } from "effect"

/**
 * Thin helper that resolves an environment name or UUID to a ready-to-use
 * `WorkflowReader` or `OverviewReader` via `DbManager`.
 *
 * Accepts either the environment name (e.g. `"local"`, `"production"`) or
 * its UUID — whichever is more convenient for the caller.
 */
export class EnvReader extends Effect.Service<EnvReader>()("EnvReader", {
  effect: Effect.gen(function*() {
    const db = yield* DbManager
    const envRepo = yield* EnvironmentRepository

    /**
     * Resolve an environment name or UUID to a validated envId.
     */
    const resolveEnvId = (nameOrId: string): Effect.Effect<string, Error> =>
      Effect.gen(function*() {
        // Try name first (user-friendly)
        const byName = yield* envRepo.getByName(nameOrId)
        if (byName !== null) return byName.id

        // Then try UUID
        const byId = yield* envRepo.getById(nameOrId)
        if (byId !== null) return byId.id

        return yield* Effect.fail(
          new Error(
            `Environment "${nameOrId}" not found. Use the "list_environments" resource to see available environments.`
          )
        )
      })

    const getClient = (nameOrId: string) =>
      Effect.gen(function*() {
        const envId = yield* resolveEnvId(nameOrId)
        return yield* db.getClient(envId)
      })

    const getWorkflowReader = (nameOrId: string) =>
      Effect.gen(function*() {
        const pg = yield* getClient(nameOrId)
        return makeWorkflowReader(pg)
      })

    const getOverviewReader = (nameOrId: string) =>
      Effect.gen(function*() {
        const pg = yield* getClient(nameOrId)
        return makeOverviewReader(pg)
      })

    /** List all configured environments (name + id) for discoverability. */
    const list = envRepo.list

    return { getClient, getWorkflowReader, getOverviewReader, list } as const
  }),
  dependencies: [DbManager.Default, EnvironmentRepository.Default]
}) {}
