import { MessageId } from "@template/domain/run/MessageId"
import { Effect, Either, Layer } from "effect"
import { describe, expect, it } from "vitest"
import { GetRunQuery } from "../../../src/run/query/GetRunQuery.js"
import { InMemoryWorkflowReaderLive } from "../../support/InMemoryWorkflowReader.js"
import { PARENT_ID, seed } from "../../support/seed.js"

const queryLayer = GetRunQuery.DefaultWithoutDependencies.pipe(
  Layer.provide(InMemoryWorkflowReaderLive(seed))
)

describe("GetRunQuery", () => {
  it("returns the seeded run when found", async () => {
    const detail = await Effect.runPromise(
      Effect.flatMap(GetRunQuery, (q) => q.execute(PARENT_ID)).pipe(Effect.provide(queryLayer))
    )
    expect(detail.id).toBe(PARENT_ID)
    expect(detail.workflowName).toBe("OrderFlow")
    expect(detail.status).toBe("success")
  })

  it("fails with RunNotFound when the messageId is unknown", async () => {
    const unknown = MessageId.make("999999999999999999")
    const exit = await Effect.runPromise(
      Effect.flatMap(GetRunQuery, (q) => q.execute(unknown)).pipe(
        Effect.provide(queryLayer),
        Effect.either
      )
    )
    expect(Either.isLeft(exit)).toBe(true)
    if (Either.isLeft(exit)) {
      expect(exit.left._tag).toBe("RunNotFound")
      expect(exit.left.runId).toBe(unknown)
    }
  })
})
