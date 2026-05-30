import { GetChildRunsQuery } from "@template/api/run/query/GetChildRunsQuery"
import { GetRunQuery } from "@template/api/run/query/GetRunQuery"
import { ListRunsQuery } from "@template/api/run/query/ListRunsQuery"
import { PageRequest, Paginated } from "@template/domain/Pagination"
import { MessageId } from "@template/domain/run/MessageId"
import { RunDetail } from "@template/domain/run/RunDetail"
import { RunStatus } from "@template/domain/run/RunStatus"
import { RunSummary } from "@template/domain/run/RunSummary"
import type { TraceId } from "@template/domain/run/TraceId"
import type { WorkflowName } from "@template/domain/workflow/WorkflowName"
import type { ListRunsFilter } from "@template/domain/workflow/WorkflowReader"
import { Effect, Schema } from "effect"
import { createController } from "remix/router"
import { assetServer } from "../asset-server.js"
import { runtime } from "../data/runtime.js"
import { routes } from "../routes.js"
import { buildFilterQuery, type RunsFilters } from "../utils/runs.js"
import { RunDetailPage } from "./run-detail-page.js"
import { RunsPage } from "./runs-page.js"

const PaginatedRunSummary = Paginated(RunSummary)
const encodeRuns = Schema.encodeSync(PaginatedRunSummary)
const encodeRunDetail = Schema.encodeSync(RunDetail)
const encodeChildren = Schema.encodeSync(Schema.Array(RunSummary))
const decodeMessageId = Schema.decodeUnknownSync(MessageId)
const isRunStatus = Schema.is(RunStatus)

const parseFilter = (url: URL): ListRunsFilter => {
  const status = url.searchParams.getAll("status").filter(isRunStatus)
  const workflowName = url.searchParams.get("workflowName")
  const traceId = url.searchParams.get("traceId")
  return {
    ...(status.length > 0 ? { status } : {}),
    ...(workflowName ? { workflowName: workflowName as WorkflowName } : {}),
    ...(traceId ? { traceId: traceId as TraceId } : {})
  }
}

const toFilters = (filter: ListRunsFilter): RunsFilters => ({
  status: filter.status ?? [],
  workflowName: filter.workflowName ?? null,
  traceId: filter.traceId ?? null
})

// Shared loader: parse the URL and run ListRunsQuery via the Effect runtime.
const loadRuns = (url: URL) => {
  const limitRaw = Number(url.searchParams.get("limit"))
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50
  const before = url.searchParams.get("before")
  return runtime.runPromise(
    Effect.gen(function*() {
      const listRuns = yield* ListRunsQuery
      return yield* listRuns.execute(parseFilter(url), new PageRequest({ limit, before }))
    })
  )
}

/**
 * Root controller — owns every direct leaf route in `routes`. Each action
 * returns an explicit `Response`; expected failures (run not found) become a
 * 404 rather than throwing.
 */
export default createController(routes, {
  actions: {
    // Compiled client assets served on demand under /assets.
    async assets({ request }) {
      return (await assetServer.fetch(request)) ?? new Response("Not Found", { status: 404 })
    },

    // GET / — server-rendered Runs page; the table hydrates for "Load more".
    async home({ render, url }) {
      const page = await loadRuns(url)
      const { items, nextCursor } = encodeRuns(page)
      const filters = toFilters(parseFilter(url))
      return render(
        <RunsPage runs={items} nextCursor={nextCursor} filters={filters} query={buildFilterQuery(filters)} />
      )
    },

    // GET /runs — paginated list as JSON; consumed by the hydrated "Load more".
    async runs({ url }) {
      const page = await loadRuns(url)
      return Response.json(encodeRuns(page))
    },

    // GET /runs/:messageId — server-rendered run detail page.
    async runShow({ params, render }) {
      const messageId = decodeMessageId(params.messageId)
      const result = await runtime.runPromise(
        Effect.gen(function*() {
          const getRun = yield* GetRunQuery
          return yield* getRun.execute(messageId)
        }).pipe(
          Effect.map((run) => ({ _tag: "ok" as const, run })),
          Effect.catchTag("RunNotFound", () => Effect.succeed({ _tag: "notFound" as const }))
        )
      )

      if (result._tag === "notFound") {
        return new Response("Run not found", { status: 404 })
      }
      return render(<RunDetailPage run={encodeRunDetail(result.run)} />)
    },

    // GET /runs/:messageId/children — sibling runs sharing the trace.
    async runChildren({ params }) {
      const messageId = decodeMessageId(params.messageId)
      const result = await runtime.runPromise(
        Effect.gen(function*() {
          const getRun = yield* GetRunQuery
          const getChildRuns = yield* GetChildRunsQuery
          const run = yield* getRun.execute(messageId)
          if (run.traceId === null) return { _tag: "ok" as const, children: [] as ReadonlyArray<RunSummary> }
          const children = yield* getChildRuns.execute(run.traceId, messageId)
          return { _tag: "ok" as const, children }
        }).pipe(
          Effect.catchTag("RunNotFound", () => Effect.succeed({ _tag: "notFound" as const }))
        )
      )

      if (result._tag === "notFound") {
        return new Response("Run not found", { status: 404 })
      }
      return Response.json(encodeChildren(result.children))
    }
  }
})
