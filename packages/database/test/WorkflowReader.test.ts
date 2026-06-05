import { SqlClient } from "@effect/sql"
import { MessageId } from "@template/domain/run/MessageId"
import { snowflakeToMillis } from "@template/domain/run/Snowflake"
import { TraceId } from "@template/domain/run/TraceId"
import type { WorkflowName } from "@template/domain/workflow/WorkflowName"
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { Effect, Either, Layer } from "effect"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { WorkflowReader } from "../src/repository/workflowReader/WorkflowReader.js"
import { applyClusterSchema, sqlLayerFor, startPgContainer } from "./PgTestContainer.js"

const TEST_TIMEOUT = 90_000

const PARENT_ID = MessageId.make("100000000000000001")
const CHILD_A_ID = MessageId.make("100000000000000002")
const CHILD_B_ID = MessageId.make("100000000000000003")
const FAILED_ID = MessageId.make("100000000000000004")
const RUNNING_ID = MessageId.make("100000000000000005")
const ENTITY_ID = MessageId.make("100000000000000006")
const TRACE_PARENT = TraceId.make("abc123abc123abc123abc123abc12300")
const TRACE_OTHER = TraceId.make("ffffffffffffffffffffffffffffffff")

const successExit = JSON.stringify({
  _tag: "Success",
  value: {
    _tag: "Complete",
    exit: { _tag: "Success", value: { ok: true } }
  }
})

const failExit = JSON.stringify({
  _tag: "Success",
  value: {
    _tag: "Complete",
    exit: {
      _tag: "Failure",
      cause: { _tag: "Fail", error: "boom" }
    }
  }
})

const seed = Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    INSERT INTO cluster_messages
      (id, shard_id, entity_type, entity_id, kind, tag, payload, headers, trace_id, processed, request_id, last_reply_id, last_read)
    VALUES
      (${PARENT_ID}, 'default:1', 'Workflow/OrderFlow', 'order-1', 0, 'run', '{"input":1}', '{}', '${TRACE_PARENT}', TRUE, ${PARENT_ID}, 200000000000000001, NOW() - INTERVAL '1 hour'),
      (${CHILD_A_ID}, 'default:2', 'Workflow/PaymentSubFlow', 'payment-a', 0, 'run', '{"amount":10}', '{}', '${TRACE_PARENT}', TRUE, ${CHILD_A_ID}, 200000000000000002, NOW() - INTERVAL '50 minutes'),
      (${CHILD_B_ID}, 'default:3', 'Workflow/EmailSubFlow', 'email-b', 0, 'run', '{"to":"x"}', '{}', '${TRACE_PARENT}', TRUE, ${CHILD_B_ID}, 200000000000000003, NOW() - INTERVAL '40 minutes'),
      (${FAILED_ID}, 'default:4', 'Workflow/OrderFlow', 'order-2', 0, 'run', '{"input":2}', '{}', '${TRACE_OTHER}', TRUE, ${FAILED_ID}, 200000000000000004, NOW() - INTERVAL '2 hours'),
      (${RUNNING_ID}, 'default:5', 'Workflow/OrderFlow', 'order-3', 0, 'run', '{"input":3}', '{}', NULL, FALSE, ${RUNNING_ID}, NULL, NOW()),
      (${ENTITY_ID}, 'default:6', 'User', 'user-1', 0, 'someRpc', '{"x":1}', '{}', NULL, TRUE, ${ENTITY_ID}, 200000000000000006, NOW() - INTERVAL '1 hour')
  `)

  yield* sql.unsafe(`
    INSERT INTO cluster_replies (id, kind, request_id, payload, sequence, acked) VALUES
      (200000000000000001, 0, ${PARENT_ID}, '${successExit.replace(/'/g, "''")}', NULL, FALSE),
      (200000000000000002, 0, ${CHILD_A_ID}, '${successExit.replace(/'/g, "''")}', NULL, FALSE),
      (200000000000000003, 0, ${CHILD_B_ID}, '${failExit.replace(/'/g, "''")}', NULL, FALSE),
      (200000000000000004, 0, ${FAILED_ID}, '${failExit.replace(/'/g, "''")}', NULL, FALSE),
      (200000000000000006, 0, ${ENTITY_ID}, '{"_tag":"Success","value":"ok"}', NULL, FALSE)
  `)
})

describe("WorkflowReader (integration)", () => {
  let container: StartedPostgreSqlContainer
  let appLayer: ReturnType<typeof buildLayer>

  const buildLayer = (c: StartedPostgreSqlContainer) => {
    const sqlLayer = Layer.orDie(sqlLayerFor(c))
    return Layer.merge(
      sqlLayer,
      WorkflowReader.DefaultWithoutDependencies.pipe(Layer.provide(sqlLayer))
    )
  }

  beforeAll(async () => {
    container = await startPgContainer()
    const sqlLayer = Layer.orDie(sqlLayerFor(container))
    appLayer = buildLayer(container)
    await Effect.runPromise(applyClusterSchema.pipe(Effect.provide(sqlLayer), Effect.orDie))
    await Effect.runPromise(seed.pipe(Effect.provide(sqlLayer), Effect.orDie))
  }, TEST_TIMEOUT)

  afterAll(async () => {
    if (container) {
      await container.stop()
    }
  }, TEST_TIMEOUT)

  it("listRuns excludes non-workflow entities and decodes statuses", async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(WorkflowReader, (r) => r.listRuns({}, { limit: 50, before: null })).pipe(Effect.provide(appLayer))
    )
    const ids = result.items.map((r) => r.id).sort()
    expect(ids).toEqual([
      CHILD_A_ID,
      CHILD_B_ID,
      FAILED_ID,
      PARENT_ID,
      RUNNING_ID
    ].sort())
    const byId = new Map(result.items.map((r) => [r.id, r]))
    expect(byId.get(PARENT_ID)?.status).toBe("success")
    expect(byId.get(CHILD_A_ID)?.status).toBe("success")
    expect(byId.get(CHILD_B_ID)?.status).toBe("failed_app")
    expect(byId.get(FAILED_ID)?.status).toBe("failed_app")
    expect(byId.get(RUNNING_ID)?.status).toBe("running")
    expect(byId.get(PARENT_ID)?.workflowName).toBe("OrderFlow")
  })

  it("listRuns paginates via cursor (limit=2)", async () => {
    const page1 = await Effect.runPromise(
      Effect.flatMap(WorkflowReader, (r) => r.listRuns({}, { limit: 2, before: null })).pipe(Effect.provide(appLayer))
    )
    expect(page1.items.length).toBe(2)
    expect(page1.nextCursor).not.toBeNull()
    const page2 = await Effect.runPromise(
      Effect.flatMap(WorkflowReader, (r) => r.listRuns({}, { limit: 2, before: page1.nextCursor })).pipe(
        Effect.provide(appLayer)
      )
    )
    expect(page2.items.length).toBe(2)
    const allIds = new Set([...page1.items, ...page2.items].map((r) => r.id))
    expect(allIds.size).toBe(4)
  })

  it("listRuns filters by status", async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(WorkflowReader, (r) => r.listRuns({ status: ["failed_app"] }, { limit: 50, before: null })).pipe(
        Effect.provide(appLayer)
      )
    )
    expect(result.items.map((r) => r.id).sort()).toEqual([CHILD_B_ID, FAILED_ID].sort())
  })

  it("listRuns filters by workflowName prefix", async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(
        WorkflowReader,
        (r) => r.listRuns({ workflowName: "OrderFlow" as WorkflowName }, { limit: 50, before: null })
      )
        .pipe(Effect.provide(appLayer))
    )
    const names = new Set(result.items.map((r) => r.workflowName))
    expect(names).toEqual(new Set(["OrderFlow"]))
  })

  it("sets startedAt from last_read and durationMs from the reply id Snowflake", async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(WorkflowReader, (r) => r.listRuns({}, { limit: 50, before: null })).pipe(Effect.provide(appLayer))
    )
    const byId = new Map(result.items.map((r) => [r.id, r]))
    const parent = byId.get(PARENT_ID)!
    // startedAt is the real last_read timestamp (seeded ~1h ago).
    expect(parent.startedAt).not.toBeNull()
    // duration = reply-id ts − message-id ts (both treated as Snowflakes).
    expect(parent.durationMs).toBe(snowflakeToMillis(200000000000000001n) - snowflakeToMillis(BigInt(PARENT_ID)))
    // A run with no reply yet has a start but no duration.
    const running = byId.get(RUNNING_ID)!
    expect(running.startedAt).not.toBeNull()
    expect(running.durationMs).toBeNull()
  })

  it("listRuns filters by date range on last_read", async () => {
    // Seeded last_read offsets: PARENT −60m, CHILD_A −50m, CHILD_B −40m,
    // FAILED −120m, RUNNING now. A 90-minute window excludes only FAILED.
    const now = Date.now()
    const within = await Effect.runPromise(
      Effect.flatMap(
        WorkflowReader,
        (r) => r.listRuns({ from: new Date(now - 90 * 60_000) }, { limit: 50, before: null })
      ).pipe(Effect.provide(appLayer))
    )
    expect(within.items.map((r) => r.id).sort()).toEqual(
      [CHILD_A_ID, CHILD_B_ID, PARENT_ID, RUNNING_ID].sort()
    )
    // A window entirely in the future returns nothing.
    const future = await Effect.runPromise(
      Effect.flatMap(
        WorkflowReader,
        (r) => r.listRuns({ from: new Date(now + 60 * 60_000) }, { limit: 50, before: null })
      )
        .pipe(Effect.provide(appLayer))
    )
    expect(future.items.length).toBe(0)
  })

  it("getRun returns detail with parsed input/output and children sharing trace_id", async () => {
    const detail = await Effect.runPromise(
      Effect.flatMap(WorkflowReader, (r) => r.getRun(PARENT_ID)).pipe(Effect.provide(appLayer))
    )
    expect(detail.id).toBe(PARENT_ID)
    expect(detail.status).toBe("success")
    expect(detail.input).toEqual({ input: 1 })
    expect((detail.output as any)._tag).toBe("Success")
    const childIds = detail.children.map((c) => c.id).sort()
    expect(childIds).toEqual([CHILD_A_ID, CHILD_B_ID].sort())
  })

  it("getRun fails with RunNotFound for unknown id", async () => {
    const exit = await Effect.runPromise(
      Effect.flatMap(WorkflowReader, (r) => r.getRun("999999999999999999" as MessageId)).pipe(
        Effect.provide(appLayer),
        Effect.either
      )
    )
    expect(Either.isLeft(exit)).toBe(true)
    if (Either.isLeft(exit)) {
      expect(exit.left._tag).toBe("RunNotFound")
      expect(exit.left.runId).toBe("999999999999999999")
    }
  })

  it("getRun fails with RunNotFound for malformed id", async () => {
    const exit = await Effect.runPromise(
      Effect.flatMap(WorkflowReader, (r) => r.getRun("not-a-bigint" as MessageId)).pipe(
        Effect.provide(appLayer),
        Effect.either
      )
    )
    expect(Either.isLeft(exit)).toBe(true)
  })

  it("getChildRuns returns siblings sharing trace_id excluding the parent", async () => {
    const children = await Effect.runPromise(
      Effect.flatMap(WorkflowReader, (r) => r.getChildRuns(TRACE_PARENT, PARENT_ID)).pipe(Effect.provide(appLayer))
    )
    expect(children.map((c) => c.id).sort()).toEqual([CHILD_A_ID, CHILD_B_ID].sort())
  })
})
