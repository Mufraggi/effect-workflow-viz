import { McpSchema, McpServer, Tool, Toolkit } from "@effect/ai"
import { buildSnapshotFromDb } from "@template/database/repository/overviewReader/snapshot"
import { Paginated } from "@template/domain/Pagination"
import type { MessageId } from "@template/domain/run/MessageId"
import { RunDetail } from "@template/domain/run/RunDetail"
import { RunSummary } from "@template/domain/run/RunSummary"
import type { TraceId } from "@template/domain/run/TraceId"
import { Effect, Layer, pipe, Schema } from "effect"
import { EnvReader } from "./EnvReader.js"

// ---------------------------------------------------------------------------
// URI parameter for the envId in resource templates
// ---------------------------------------------------------------------------
const envIdParam = McpSchema.param("envId", Schema.String)

// ---------------------------------------------------------------------------
// Resources (read-only cluster data)
// ---------------------------------------------------------------------------

/** `cluster://{envId}/overview` — Full cluster overview snapshot */
export const OverviewResource = McpServer.resource`cluster://${envIdParam}/overview`({
  name: "cluster-overview",
  description: "Full cluster overview snapshot including stats, workflow counts, nodes, shards, and activity",
  mimeType: "application/json",
  content: Effect.fn(function*(_uri: string, envId: string) {
    const env = yield* EnvReader
    const reader = yield* env.getOverviewReader(envId)
    const raw = yield* reader.buildSnapshot()
    const snapshot = buildSnapshotFromDb(raw)
    return JSON.stringify(snapshot)
  })
})

/** `cluster://{envId}/nodes` — List of cluster nodes/runners */
export const NodesResource = McpServer.resource`cluster://${envIdParam}/nodes`({
  name: "cluster-nodes",
  description: "List of cluster nodes (runners) with health status and assigned shard counts",
  mimeType: "application/json",
  content: Effect.fn(function*(_uri: string, envId: string) {
    const env = yield* EnvReader
    const reader = yield* env.getOverviewReader(envId)
    const raw = yield* reader.buildSnapshot()
    const snapshot = buildSnapshotFromDb(raw)
    return JSON.stringify(snapshot.nodes)
  })
})

/** `cluster://{envId}/shards` — List of shards with assignment status */
export const ShardsResource = McpServer.resource`cluster://${envIdParam}/shards`({
  name: "cluster-shards",
  description: "List of shards with assignment status and entity counts",
  mimeType: "application/json",
  content: Effect.fn(function*(_uri: string, envId: string) {
    const env = yield* EnvReader
    const reader = yield* env.getOverviewReader(envId)
    const raw = yield* reader.buildSnapshot()
    const snapshot = buildSnapshotFromDb(raw)
    return JSON.stringify(snapshot.shards)
  })
})

/** `cluster://{envId}/workflow-types` — Distinct workflow names observed */
export const WorkflowTypesResource = McpServer.resource`cluster://${envIdParam}/workflow-types`({
  name: "cluster-workflow-types",
  description: "Distinct workflow (entity) types observed on the cluster",
  mimeType: "application/json",
  content: Effect.fn(function*(_uri: string, envId: string) {
    const env = yield* EnvReader
    const reader = yield* env.getOverviewReader(envId)
    const raw = yield* reader.buildSnapshot()
    return JSON.stringify(raw.entityTypes.map((e: { entityType: string }) => e.entityType))
  })
})

// ---------------------------------------------------------------------------
// Response schemas for tools
// ---------------------------------------------------------------------------

const ListExecutionsResult = Paginated(RunSummary)

// ---------------------------------------------------------------------------
// Parameter schemas — built via Schema.Struct, then .fields passed to Tool
// ---------------------------------------------------------------------------

const listExecutionsParams = Schema.Struct({
  envId: Schema.String,
  limit: Schema.optionalWith(Schema.Number, { default: () => 50 }),
  before: Schema.optionalWith(Schema.String, { default: () => "" }),
  status: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] as Array<string> }),
  workflowName: Schema.optionalWith(Schema.String, { default: () => "" }),
  traceId: Schema.optionalWith(Schema.String, { default: () => "" }),
  from: Schema.optionalWith(Schema.String, { default: () => "" }),
  to: Schema.optionalWith(Schema.String, { default: () => "" })
})

const getExecutionParams = Schema.Struct({
  envId: Schema.String,
  executionId: Schema.optionalWith(Schema.String, { default: () => "" }),
  messageId: Schema.optionalWith(Schema.String, { default: () => "" })
})

const getExecutionChildrenParams = Schema.Struct({
  envId: Schema.String,
  messageId: Schema.String
})

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/**
 * list_executions — List workflow executions with optional filters.
 */
const listExecutionsTool = Tool.make("list_executions", {
  description: "List workflow executions with optional filters (status, workflow name, trace id, date range)",
  parameters: listExecutionsParams.fields,
  success: ListExecutionsResult,
  failure: Schema.String,
  failureMode: "return" as const,
  dependencies: [EnvReader]
})

/**
 * get_execution — Get a single execution by executionId (entity_id) or messageId.
 */
const getExecutionTool = Tool.make("get_execution", {
  description: "Get detailed information about a single workflow execution by executionId (entity_id) or messageId",
  parameters: getExecutionParams.fields,
  success: RunDetail,
  failure: Schema.String,
  failureMode: "return" as const,
  dependencies: [EnvReader]
})

/**
 * get_execution_children — Get child runs (same trace, excluding parent) for a message.
 */
const getExecutionChildrenTool = Tool.make("get_execution_children", {
  description: "Get child workflow executions for a given parent messageId",
  parameters: getExecutionChildrenParams.fields,
  success: Schema.Array(RunSummary),
  failure: Schema.String,
  failureMode: "return" as const,
  dependencies: [EnvReader]
})

// ---------------------------------------------------------------------------
// Toolkit — all tools registered together
// ---------------------------------------------------------------------------

export const ClusterTools = Toolkit.make(
  listExecutionsTool,
  getExecutionTool,
  getExecutionChildrenTool
)

// ---------------------------------------------------------------------------
// Handler implementations
// ---------------------------------------------------------------------------

export const ClusterToolsLayer = ClusterTools.toLayer({
  list_executions: (params) =>
    Effect.gen(function*() {
      const env = yield* EnvReader
      const reader = yield* env.getWorkflowReader(params.envId)

      const filter: Record<string, unknown> = {}
      if (params.status && params.status.length > 0) filter.status = params.status
      if (params.workflowName) filter.workflowName = params.workflowName
      if (params.traceId) filter.traceId = params.traceId
      if (params.from) filter.from = new Date(params.from)
      if (params.to) filter.to = new Date(params.to)

      const pageRequest = {
        limit: params.limit,
        before: params.before && params.before.length > 0 ? params.before : null
      }

      const result = yield* reader.listRuns(filter, pageRequest)
      return { items: result.items, nextCursor: result.nextCursor }
    }).pipe(
      Effect.mapError((error: unknown) => String(error))
    ),

  get_execution: (params) =>
    pipe(
      EnvReader,
      Effect.flatMap((env) => env.getWorkflowReader(params.envId)),
      Effect.flatMap((reader) => {
        if (params.executionId) {
          return reader.getRunByExecutionId(params.executionId).pipe(
            Effect.mapError((e: unknown) => String(e))
          )
        }
        if (params.messageId) {
          return reader.getRun(params.messageId as unknown as MessageId).pipe(
            Effect.mapError((e: unknown) => String(e))
          )
        }
        return Effect.fail<string>("Must provide either executionId or messageId")
      })
    ) as Effect.Effect<RunDetail, string, EnvReader>,

  get_execution_children: (params) =>
    pipe(
      EnvReader,
      Effect.flatMap((env) => env.getWorkflowReader(params.envId)),
      Effect.flatMap((reader) =>
        pipe(
          reader.getRun(params.messageId as unknown as MessageId),
          Effect.mapError((e: unknown) => String(e)),
          Effect.flatMap((parent) => {
            if (!parent.traceId) {
              return Effect.succeed([] as ReadonlyArray<RunSummary>)
            }
            return reader.getChildRuns(
              parent.traceId as unknown as TraceId,
              params.messageId as unknown as MessageId
            ).pipe(
              Effect.mapError((e: unknown) => String(e))
            )
          })
        )
      )
    ) as Effect.Effect<ReadonlyArray<RunSummary>, string, EnvReader>
})

// ---------------------------------------------------------------------------
// Registration layer — merges all resources and toolkit registration
// ---------------------------------------------------------------------------

export const McpRegistrationLayer = Layer.mergeAll(
  OverviewResource,
  NodesResource,
  ShardsResource,
  WorkflowTypesResource,
  McpServer.toolkit(ClusterTools)
)
