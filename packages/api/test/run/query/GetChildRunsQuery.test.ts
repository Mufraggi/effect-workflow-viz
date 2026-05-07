import { Effect, Layer } from "effect"
import { describe, expect, it } from "vitest"
import { GetChildRunsQuery } from "../../../src/run/query/GetChildRunsQuery.js"
import { InMemoryWorkflowReaderLive } from "../../support/InMemoryWorkflowReader.js"
import { CHILD_A_ID, CHILD_B_ID, FAILED_ID, PARENT_ID, seed, TRACE_OTHER, TRACE_PARENT } from "../../support/seed.js"

const queryLayer = GetChildRunsQuery.DefaultWithoutDependencies.pipe(
  Layer.provide(InMemoryWorkflowReaderLive(seed))
)

describe("GetChildRunsQuery", () => {
  it("returns siblings sharing the trace_id excluding the parent", async () => {
    const children = await Effect.runPromise(
      Effect.flatMap(GetChildRunsQuery, (q) => q.execute(TRACE_PARENT, PARENT_ID)).pipe(
        Effect.provide(queryLayer)
      )
    )
    expect(children.map((c) => c.id).sort()).toEqual([CHILD_A_ID, CHILD_B_ID].sort())
  })

  it("returns the only run sharing the other trace_id when its sibling is excluded", async () => {
    const children = await Effect.runPromise(
      Effect.flatMap(GetChildRunsQuery, (q) => q.execute(TRACE_OTHER, FAILED_ID)).pipe(
        Effect.provide(queryLayer)
      )
    )
    expect(children).toEqual([])
  })

  it("returns an empty array for an unknown trace_id", async () => {
    const children = await Effect.runPromise(
      Effect.flatMap(
        GetChildRunsQuery,
        (q) => q.execute(TRACE_OTHER, PARENT_ID)
      ).pipe(Effect.provide(queryLayer))
    )
    expect(children.map((c) => c.id)).toEqual([FAILED_ID])
  })
})
