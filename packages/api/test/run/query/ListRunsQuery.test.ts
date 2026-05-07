import { PageRequest } from "@template/domain/Pagination"
import { WorkflowName } from "@template/domain/workflow/WorkflowName"
import { Effect, Layer } from "effect"
import { describe, expect, it } from "vitest"
import { ListRunsQuery } from "../../../src/run/query/ListRunsQuery.js"
import { InMemoryWorkflowReaderLive } from "../../support/InMemoryWorkflowReader.js"
import { CHILD_A_ID, CHILD_B_ID, FAILED_ID, PARENT_ID, seed, TRACE_PARENT } from "../../support/seed.js"

const queryLayer = ListRunsQuery.DefaultWithoutDependencies.pipe(
  Layer.provide(InMemoryWorkflowReaderLive(seed))
)

const run = <A, E>(eff: Effect.Effect<A, E, ListRunsQuery>) => Effect.runPromise(eff.pipe(Effect.provide(queryLayer)))

describe("ListRunsQuery", () => {
  it("returns every seeded run when no filter is provided", async () => {
    const result = await run(
      Effect.flatMap(ListRunsQuery, (q) => q.execute({}, new PageRequest({ limit: 50, before: null })))
    )
    expect(result.items.map((r) => r.id).sort()).toEqual(
      [PARENT_ID, CHILD_A_ID, CHILD_B_ID, FAILED_ID].sort()
    )
    expect(result.nextCursor).toBeNull()
  })

  it("filters by workflowName", async () => {
    const result = await run(
      Effect.flatMap(
        ListRunsQuery,
        (q) =>
          q.execute(
            { workflowName: WorkflowName.make("OrderFlow") },
            new PageRequest({ limit: 50, before: null })
          )
      )
    )
    expect(result.items.map((r) => r.id).sort()).toEqual([PARENT_ID, FAILED_ID].sort())
  })

  it("filters by status", async () => {
    const result = await run(
      Effect.flatMap(
        ListRunsQuery,
        (q) => q.execute({ status: ["failed_app"] }, new PageRequest({ limit: 50, before: null }))
      )
    )
    expect(result.items.map((r) => r.id).sort()).toEqual([CHILD_B_ID, FAILED_ID].sort())
  })

  it("filters by traceId", async () => {
    const result = await run(
      Effect.flatMap(
        ListRunsQuery,
        (q) => q.execute({ traceId: TRACE_PARENT }, new PageRequest({ limit: 50, before: null }))
      )
    )
    expect(result.items.map((r) => r.id).sort()).toEqual([PARENT_ID, CHILD_A_ID, CHILD_B_ID].sort())
  })

  it("paginates via cursor", async () => {
    const page1 = await run(
      Effect.flatMap(ListRunsQuery, (q) => q.execute({}, new PageRequest({ limit: 2, before: null })))
    )
    expect(page1.items.length).toBe(2)
    expect(page1.nextCursor).not.toBeNull()

    const page2 = await run(
      Effect.flatMap(ListRunsQuery, (q) => q.execute({}, new PageRequest({ limit: 2, before: page1.nextCursor })))
    )
    expect(page2.items.length).toBe(2)
    const ids = new Set([...page1.items, ...page2.items].map((r) => r.id))
    expect(ids.size).toBe(4)
  })
})
