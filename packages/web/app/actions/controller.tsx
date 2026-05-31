import { GetChildRunsQuery } from "@template/api/run/query/GetChildRunsQuery"
import { GetRunQuery } from "@template/api/run/query/GetRunQuery"
import { ListRunsQuery } from "@template/api/run/query/ListRunsQuery"
import { AuthRepository } from "@template/auth/AuthRepository"
import { hashPassword } from "@template/auth/password"
import { Email } from "@template/domain/auth/Email"
import { PageRequest, Paginated } from "@template/domain/Pagination"
import { MessageId } from "@template/domain/run/MessageId"
import { RunDetail } from "@template/domain/run/RunDetail"
import { RunStatus } from "@template/domain/run/RunStatus"
import { RunSummary } from "@template/domain/run/RunSummary"
import type { TraceId } from "@template/domain/run/TraceId"
import type { WorkflowName } from "@template/domain/workflow/WorkflowName"
import type { ListRunsFilter } from "@template/domain/workflow/WorkflowReader"
import { Effect, Option, Schema } from "effect"
import { completeAuth, verifyCredentials } from "remix/auth"
import { redirect } from "remix/response/redirect"
import { createController } from "remix/router"
import { assetServer } from "../asset-server.js"
import { requireAuthRedirect, setupGuard } from "../auth/guards.js"
import { passwordProvider } from "../auth/provider.js"
import { runtime } from "../data/runtime.js"
import { routes } from "../routes.js"
import { buildFilterQuery, type RunsFilters } from "../utils/runs.js"
import { LoginPage } from "./login-page.js"
import { RunDetailPage } from "./run-detail-page.js"
import { RunsPage } from "./runs-page.js"
import { SetupPage } from "./setup-page.js"

const PaginatedRunSummary = Paginated(RunSummary)
const encodeRuns = Schema.encodeSync(PaginatedRunSummary)
const encodeRunDetail = Schema.encodeSync(RunDetail)
const encodeChildren = Schema.encodeSync(Schema.Array(RunSummary))
const decodeMessageId = Schema.decodeUnknownSync(MessageId)
const isRunStatus = Schema.is(RunStatus)
const decodeEmail = Schema.decodeUnknownOption(Email)

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

const countUsers = () =>
  runtime.runPromise(
    Effect.gen(function*() {
      const repo = yield* AuthRepository
      return yield* repo.countUsers
    })
  )

// Only honor local redirect targets — never an absolute URL (open-redirect guard).
const safeReturnTo = (value: string | null): string =>
  value !== null && value.startsWith("/") && !value.startsWith("//") ? value : routes.home.href()

// Protect the workflow-viewing routes: force first-run setup, then require auth.
const protect = [setupGuard(), requireAuthRedirect()] as const

/**
 * Root controller — owns every direct leaf route in `routes`. The workflow
 * routes are guarded (setup → auth); the auth routes are public and branch on
 * the request method.
 */
export default createController(routes, {
  actions: {
    // Compiled client assets served on demand under /assets.
    async assets({ request }) {
      return (await assetServer.fetch(request)) ?? new Response("Not Found", { status: 404 })
    },

    // GET shows the first-run admin form; POST creates the one and only admin.
    // Self-guards on the account count so it can run exactly once.
    async setup(context) {
      if ((await countUsers()) > 0) return redirect(routes.login.href(), 303)
      if (context.method !== "POST") {
        const error = context.session.get("error") as string | undefined
        return context.render(<SetupPage error={error ?? null} />)
      }

      const form = context.get(FormData)
      const emailRaw = String(form?.get("email") ?? "")
      const password = String(form?.get("password") ?? "")
      const email = decodeEmail(emailRaw)

      if (Option.isNone(email)) {
        context.session.flash("error", "Enter a valid email address.")
        return redirect(routes.setup.href(), 303)
      }
      if (password.length < 8) {
        context.session.flash("error", "Password must be at least 8 characters.")
        return redirect(routes.setup.href(), 303)
      }

      const result = await runtime.runPromise(
        Effect.gen(function*() {
          const repo = yield* AuthRepository
          const passwordHash = yield* hashPassword(password)
          return yield* repo.createUser({ email: email.value, passwordHash, role: "admin" })
        }).pipe(
          Effect.map((user) => ({ _tag: "ok" as const, user })),
          Effect.catchTag("UserAlreadyExists", () => Effect.succeed({ _tag: "exists" as const }))
        )
      )

      if (result._tag === "exists") return redirect(routes.login.href(), 303)

      const session = completeAuth(context)
      session.set("auth", { userId: result.user.id })
      return redirect(routes.home.href(), 303)
    },

    // GET shows the login form; POST verifies credentials and starts a session.
    login: {
      middleware: [setupGuard()],
      async handler(context) {
        const returnTo = context.url.searchParams.get("returnTo")
        if (context.method !== "POST") {
          const error = context.session.get("error") as string | undefined
          return context.render(<LoginPage error={error ?? null} returnTo={returnTo} />)
        }

        const user = await verifyCredentials(passwordProvider, context)
        if (user == null) {
          context.session.flash("error", "Invalid email or password.")
          const qs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""
          return redirect(routes.login.href() + qs, 303)
        }

        const session = completeAuth(context)
        session.set("auth", { userId: user.id })
        const form = context.get(FormData)
        return redirect(safeReturnTo(String(form?.get("returnTo") ?? returnTo ?? "")), 303)
      }
    },

    // POST clears the session and returns to login.
    async logout(context) {
      if (context.method !== "POST") return redirect(routes.home.href(), 303)
      context.session.destroy()
      return redirect(routes.login.href(), 303)
    },

    // GET / — server-rendered Runs page; the table hydrates for "Load more".
    home: {
      middleware: protect,
      async handler({ render, url }) {
        const page = await loadRuns(url)
        const { items, nextCursor } = encodeRuns(page)
        const filters = toFilters(parseFilter(url))
        return render(
          <RunsPage runs={items} nextCursor={nextCursor} filters={filters} query={buildFilterQuery(filters)} />
        )
      }
    },

    // GET /runs — paginated list as JSON; consumed by the hydrated "Load more".
    runs: {
      middleware: protect,
      async handler({ url }) {
        const page = await loadRuns(url)
        return Response.json(encodeRuns(page))
      }
    },

    // GET /runs/:messageId — server-rendered run detail page.
    runShow: {
      middleware: protect,
      async handler({ params, render }) {
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
      }
    },

    // GET /runs/:messageId/children — sibling runs sharing the trace.
    runChildren: {
      middleware: protect,
      async handler({ params }) {
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
  }
})
