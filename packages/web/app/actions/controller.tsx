import { ApiKeyRepository } from "@template/auth/ApiKeyRepository"
import { AuthRepository } from "@template/auth/AuthRepository"
import { hashPassword } from "@template/auth/password"
import { makeOverviewReader } from "@template/database/repository/overviewReader/OverviewReader"
import { makeWorkflowReader } from "@template/database/repository/workflowReader/WorkflowReader"
import { Email } from "@template/domain/auth/Email"
import type { Role } from "@template/domain/auth/Role"
import { PageRequest, Paginated } from "@template/domain/Pagination"
import { MessageId } from "@template/domain/run/MessageId"
import { RunDetail } from "@template/domain/run/RunDetail"
import { RunStatus } from "@template/domain/run/RunStatus"
import { RunSummary } from "@template/domain/run/RunSummary"
import type { TraceId } from "@template/domain/run/TraceId"
import { UserId } from "@template/domain/UserId"
import type { WorkflowName } from "@template/domain/workflow/WorkflowName"
import type { ListRunsFilter } from "@template/domain/workflow/WorkflowReader"
import { DbManager } from "@template/environments/DbManager"
import { EnvironmentRepository } from "@template/environments/EnvironmentRepository"
import { Effect, Option, Schema } from "effect"
import { completeAuth, verifyCredentials } from "remix/auth"
import * as s from "remix/data-schema"
import { email as emailCheck, maxLength, minLength } from "remix/data-schema/checks"
import * as f from "remix/data-schema/form-data"
import { redirect } from "remix/response/redirect"
import { createController } from "remix/router"
import { assetServer } from "../asset-server.js"
import { resolveClientIp } from "../auth/client-ip.js"
import { requireAuthRedirect, setupGuard } from "../auth/guards.js"
import { policyUse } from "../auth/policy.js"
import { passwordProvider } from "../auth/provider.js"
import { runtime } from "../data/runtime.js"
import { routes } from "../routes.js"
import { buildSnapshotFromDb } from "../types/overview.js"
import { buildFilterQuery, type RunsFilters } from "../utils/runs.js"
import { ChartPage } from "./chart-page.js"
import { ExecutionDetailPage } from "./execution-detail-page.js"
import { ExecutionsPage } from "./executions-page.js"
import { LoginPage } from "./login-page.js"
import { NodesPage } from "./nodes-page.js"
import { OverviewPage } from "./overview-page.js"
import { RunDetailPage } from "./run-detail-page.js"
import { RunsPage } from "./runs-page.js"
import { SettingsPage } from "./settings-page.js"
import { SetupPage } from "./setup-page.js"
import { ShardsPage } from "./shards-page.js"

// Safely extract the current user's role from the request context.
// requireAuthRedirect guarantees auth.ok at runtime for guarded routes.
const currentRole = (auth: unknown): Role | undefined => {
  const a = auth as { ok: boolean; identity?: { role: Role } } | undefined
  return a?.ok ? a.identity?.role : undefined
}

const PaginatedRunSummary = Paginated(RunSummary)
const encodeRuns = Schema.encodeSync(PaginatedRunSummary)
const encodeRunDetail = Schema.encodeSync(RunDetail)
const encodeChildren = Schema.encodeSync(Schema.Array(RunSummary))
const decodeMessageId = Schema.decodeUnknownSync(MessageId)
const isRunStatus = Schema.is(RunStatus)
const decodeEmail = Schema.decodeUnknownOption(Email)

// First-run admin form: validated with data-schema (format + min length).
const setupSchema = f.object({
  email: f.field(s.string().pipe(emailCheck())),
  password: f.field(s.string().pipe(minLength(8)))
})

// Admin account-management forms on the settings page.
const createUserSchema = f.object({
  email: f.field(s.string().pipe(emailCheck())),
  password: f.field(s.string().pipe(minLength(8))),
  role: f.field(s.union([s.literal("admin"), s.literal("user"), s.literal("readonly"), s.literal("guest")]))
})
const updateUserSchema = f.object({
  id: f.field(s.string().pipe(minLength(1))),
  role: f.field(s.union([s.literal("admin"), s.literal("user"), s.literal("readonly"), s.literal("guest")])),
  password: f.field(s.defaulted(s.string(), ""))
})
const deleteUserSchema = f.object({
  id: f.field(s.string().pipe(minLength(1)))
})

// Admin environment-management form on the settings page. Length limits keep
// the values within Postgres' constraints (identifiers cap at 63 chars).
const createEnvSchema = f.object({
  name: f.field(s.string().pipe(minLength(1), maxLength(64))),
  host: f.field(s.string().pipe(minLength(1), maxLength(255))),
  port: f.field(s.defaulted(s.string(), "")),
  user: f.field(s.string().pipe(minLength(1), maxLength(63))),
  password: f.field(s.string().pipe(minLength(1), maxLength(256))),
  dbName: f.field(s.string().pipe(minLength(1), maxLength(63))),
  ssl: f.field(s.defaulted(s.string(), "false")),
  isDefault: f.field(s.defaulted(s.string(), ""))
})
const envIdSchema = f.object({
  envId: f.field(s.string().pipe(minLength(1)))
})

// Parse a date-range param. Naive datetime-local values (no offset) are read as
// UTC so the displayed range matches the UTC timestamps shown everywhere else.
const parseDateParam = (value: string | null): Date | null => {
  if (!value) return null
  const withZ = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`
  const d = new Date(withZ)
  return Number.isNaN(d.getTime()) ? null : d
}

const parseFilter = (url: URL): ListRunsFilter => {
  const status = url.searchParams.getAll("status").filter(isRunStatus)
  const workflowName = url.searchParams.get("workflowName")
  const traceId = url.searchParams.get("traceId")
  const from = parseDateParam(url.searchParams.get("from"))
  const to = parseDateParam(url.searchParams.get("to"))
  return {
    ...(status.length > 0 ? { status } : {}),
    ...(workflowName ? { workflowName: workflowName as WorkflowName } : {}),
    ...(traceId ? { traceId: traceId as TraceId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {})
  }
}

const toFilters = (filter: ListRunsFilter): RunsFilters => ({
  status: filter.status ?? [],
  workflowName: filter.workflowName ?? null,
  traceId: filter.traceId ?? null,
  from: filter.from ? filter.from.toISOString() : null,
  to: filter.to ? filter.to.toISOString() : null
})

// The filter form always submits its text/date fields, so blank ones land in the
// URL as `workflowName=&from=&…`. When a blank filter param is present, redirect
// to the canonical (empty-free) query that `buildFilterQuery` already produces,
// so the address bar stays clean. Returns the target path, or null if nothing to strip.
const FILTER_KEYS = new Set(["status", "workflowName", "traceId", "from", "to"])
const cleanFilterUrl = (url: URL, basePath: string): string | null => {
  let hasBlank = false
  for (const [key, value] of url.searchParams) {
    if (FILTER_KEYS.has(key) && value === "") {
      hasBlank = true
      break
    }
  }
  if (!hasBlank) return null
  const qs = buildFilterQuery(toFilters(parseFilter(url)))
  return qs.length > 0 ? `${basePath}?${qs}` : basePath
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

// Shared loader: parse the URL and run ListRunsQuery via the Effect runtime.
// Requires an envId — no fallback to default env vars.
const loadRuns = (url: URL, envId: string | null) => {
  if (!envId) return Promise.resolve({ items: [], nextCursor: null })
  const limitRaw = Number(url.searchParams.get("limit"))
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50
  const before = url.searchParams.get("before")
  const filter = parseFilter(url)
  const page = new PageRequest({ limit, before })
  return loadRunsWithEnv(envId, filter, page)
}

// Chart loader: page through (PageRequest caps a single page at 200) within the
// active filter/range until CHART_MAX, so the scatter can plot the whole window
// at once. A non-null trailing cursor means the range still has more (truncated).
const CHART_MAX = 1000
const CHART_PAGE = 200
const loadChartRuns = (url: URL, envId: string | null) => {
  if (!envId) return Promise.resolve({ items: [], nextCursor: null })
  return loadChartRunsWithEnv(envId, url)
}

const countUsers = () =>
  runtime.runPromise(
    Effect.gen(function*() {
      const repo = yield* AuthRepository
      return yield* repo.countUsers
    })
  )

// Run an effect against the AuthRepository via the shared runtime.
// (A function declaration avoids the `.tsx` arrow-generic/JSX ambiguity.)
function withAuth<A>(f: (repo: AuthRepository) => Effect.Effect<A>): Promise<A> {
  return runtime.runPromise(Effect.flatMap(AuthRepository, f))
}

function runWithEnvs<A>(f: (repo: EnvironmentRepository) => Effect.Effect<A>): Promise<A> {
  return runtime.runPromise(Effect.flatMap(EnvironmentRepository, f))
}

// ---------------------------------------------------------------------------
// Environment-aware loaders — use DbManager to get a PgClient for the
// selected environment, then build a WorkflowReader from it.

const loadRunsWithEnv = (
  envId: string,
  filter: ListRunsFilter,
  page: PageRequest
) =>
  runtime.runPromise(
    Effect.gen(function*() {
      const db = yield* DbManager
      const pg = yield* db.getClient(envId)
      const reader = makeWorkflowReader(pg)
      return yield* reader.listRuns(filter, page)
    })
  )

const loadChartRunsWithEnv = (
  envId: string,
  url: URL
) =>
  runtime.runPromise(
    Effect.gen(function*() {
      const db = yield* DbManager
      const pg = yield* db.getClient(envId)
      const reader = makeWorkflowReader(pg)
      const filter = parseFilter(url)
      const items: Array<RunSummary> = []
      let before: string | null = null
      while (items.length < CHART_MAX) {
        const limit = Math.min(CHART_PAGE, CHART_MAX - items.length)
        const page: { items: ReadonlyArray<RunSummary>; nextCursor: string | null } = yield* reader.listRuns(
          filter,
          new PageRequest({ limit, before })
        )
        for (const item of page.items) items.push(item)
        before = page.nextCursor
        if (before === null || page.items.length === 0) break
      }
      return { items, nextCursor: before }
    })
  )

const loadRunDetailWithEnv = (
  envId: string,
  messageId: MessageId
) =>
  runtime.runPromiseExit(
    Effect.gen(function*() {
      const db = yield* DbManager
      const pg = yield* db.getClient(envId)
      const reader = makeWorkflowReader(pg)
      const run = yield* reader.getRun(messageId)
      return { _tag: "ok" as const, run }
    })
  )

const loadExecutionDetailWithEnv = (
  envId: string,
  executionId: string
) =>
  runtime.runPromiseExit(
    Effect.gen(function*() {
      const db = yield* DbManager
      const pg = yield* db.getClient(envId)
      const reader = makeWorkflowReader(pg)
      const run = yield* reader.getRunByExecutionId(executionId)
      return { _tag: "ok" as const, run }
    })
  )

const loadChildrenWithEnv = (
  envId: string,
  messageId: MessageId
) =>
  runtime.runPromiseExit(
    Effect.gen(function*() {
      const db = yield* DbManager
      const pg = yield* db.getClient(envId)
      const reader = makeWorkflowReader(pg)
      const run = yield* reader.getRun(messageId)
      if (run.traceId === null) {
        return { _tag: "ok" as const, children: [] as ReadonlyArray<RunSummary> }
      }
      const children = yield* reader.getChildRuns(run.traceId, messageId)
      return { _tag: "ok" as const, children }
    })
  )

// Brute-force lockout// Brute-force lockout: block an IP after this many failures within the window.
const RATE_LIMIT_WINDOW_MINUTES = 15
const RATE_LIMIT_MAX_FAILURES = 10

// ── Overview loader ─────────────────────────────────────────────────────

const loadOverviewSnapshot = (envId: string) =>
  runtime.runPromise(
    Effect.gen(function*() {
      const db = yield* DbManager
      const pg = yield* db.getClient(envId)
      const reader = makeOverviewReader(pg)
      const raw = yield* reader.buildSnapshot()
      return buildSnapshotFromDb(raw)
    })
  )

// ── Executions loader — list all runs without pagination ──────────────

const encodeRunsFlat = Schema.encodeSync(Schema.Array(RunSummary))

// PageRequest caps a single page at 200, so page through (passing `before`)
// up to EXECUTIONS_MAX, mirroring loadChartRunsWithEnv.
const EXECUTIONS_MAX = 1000
const EXECUTIONS_PAGE = 200

const loadExecutionsWithEnv = (envId: string) =>
  runtime.runPromise(
    Effect.gen(function*() {
      const db = yield* DbManager
      const pg = yield* db.getClient(envId)
      const reader = makeWorkflowReader(pg)
      const items: Array<RunSummary> = []
      let before: string | null = null
      while (items.length < EXECUTIONS_MAX) {
        const limit = Math.min(EXECUTIONS_PAGE, EXECUTIONS_MAX - items.length)
        const page: { items: ReadonlyArray<RunSummary>; nextCursor: string | null } = yield* reader.listRuns(
          {},
          new PageRequest({ limit, before })
        )
        for (const item of page.items) items.push(item)
        before = page.nextCursor
        if (before === null || page.items.length === 0) break
      }
      return encodeRunsFlat(items)
    })
  )

// Short server-side date format for the settings activity log (UTC).
const fmtAt = (d: Date): string => d.toISOString().slice(0, 19).replace("T", " ")

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

      const parsed = s.parseSafe(setupSchema, context.get(FormData))
      if (!parsed.success) {
        context.session.flash("error", "Enter a valid email and a password of at least 8 characters.")
        return redirect(routes.setup.href(), 303)
      }
      const email = decodeEmail(parsed.value.email)
      if (Option.isNone(email)) {
        context.session.flash("error", "Enter a valid email address.")
        return redirect(routes.setup.href(), 303)
      }

      const result = await runtime.runPromise(
        Effect.gen(function*() {
          const repo = yield* AuthRepository
          const passwordHash = yield* hashPassword(parsed.value.password)
          return yield* repo.createUser({ email: email.value, passwordHash, role: "admin" })
        }).pipe(
          Effect.map((user) => ({ _tag: "ok" as const, user })),
          Effect.catchTag("UserAlreadyExists", () => Effect.succeed({ _tag: "exists" as const }))
        )
      )

      if (result._tag === "exists") return redirect(routes.login.href(), 303)

      const ip = resolveClientIp(context.request)
      const userAgent = context.request.headers.get("user-agent")
      await withAuth((r) =>
        Effect.all(
          [
            r.touchLastLogin(result.user.id),
            r.recordAudit({ event: "setup_completed", userId: result.user.id, email: result.user.email, ip, userAgent })
          ],
          { discard: true }
        )
      )

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

        const ip = resolveClientIp(context.request)
        const userAgent = context.request.headers.get("user-agent")
        const form = context.get(FormData)
        const attemptedEmail = String(form?.get("email") ?? "") || null
        const loginQs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""

        // Brute-force lockout: too many recent failures from this IP.
        if (ip !== null) {
          const failures = await withAuth((r) =>
            r.countRecentFailures({ ip, windowMinutes: RATE_LIMIT_WINDOW_MINUTES })
          )
          if (failures >= RATE_LIMIT_MAX_FAILURES) {
            await withAuth((r) => r.recordAudit({ event: "login_blocked", email: attemptedEmail, ip, userAgent }))
            context.session.flash("error", `Too many attempts. Try again in ${RATE_LIMIT_WINDOW_MINUTES} minutes.`)
            return redirect(routes.login.href() + loginQs, 303)
          }
        }

        const user = await verifyCredentials(passwordProvider, context)
        if (user == null) {
          await withAuth((r) =>
            Effect.all(
              [
                ...(ip !== null ? [r.recordLoginAttempt({ ip, succeeded: false })] : []),
                r.recordAudit({ event: "login_failure", email: attemptedEmail, ip, userAgent })
              ],
              { discard: true }
            )
          )
          context.session.flash("error", "Invalid email or password.")
          return redirect(routes.login.href() + loginQs, 303)
        }

        await withAuth((r) =>
          Effect.all(
            [
              ...(ip !== null ? [r.recordLoginAttempt({ ip, succeeded: true })] : []),
              r.touchLastLogin(user.id),
              r.recordAudit({ event: "login_success", userId: user.id, email: user.email, ip, userAgent })
            ],
            { discard: true }
          )
        )

        const session = completeAuth(context)
        session.set("auth", { userId: user.id })
        return redirect(safeReturnTo(String(form?.get("returnTo") ?? returnTo ?? "")), 303)
      }
    },

    // POST clears the auth record and rotates the session id, then returns to login.
    async logout(context) {
      if (context.method !== "POST") return redirect(routes.home.href(), 303)
      const rec = context.session.get("auth") as { userId?: string } | undefined
      const ip = resolveClientIp(context.request)
      const userAgent = context.request.headers.get("user-agent")
      context.session.unset("auth")
      context.session.regenerateId(true)
      if (rec?.userId !== undefined) {
        await withAuth((r) => r.recordAudit({ event: "logout", userId: UserId.make(rec.userId!), ip, userAgent }))
      }
      return redirect(routes.login.href(), 303)
    },

    // GET /select-env — switch active environment (stored in session).
    // Accepts `?envId=xxx&returnTo=...` from a GET form submission.
    selectEnv: {
      middleware: [...protect, policyUse("cluster", "selectEnv")],
      async handler(context) {
        const envId = context.url.searchParams.get("envId")
        if (!envId) return redirect(routes.home.href(), 303)

        // Verify the environment exists before storing.
        const env = await runtime.runPromise(
          Effect.gen(function*() {
            const repo = yield* EnvironmentRepository
            return yield* repo.getById(envId)
          })
        )
        if (!env) return redirect(routes.home.href(), 303)

        context.session.set("envId", envId)

        const returnTo = context.url.searchParams.get("returnTo") || routes.home.href()
        return redirect(safeReturnTo(returnTo), 303)
      }
    },

    // GET / — server-rendered Runs page; the table hydrates for "Load more".
    home: {
      middleware: [...protect, policyUse("workflow", "list")],
      async handler({ auth, render, session, url }) {
        const clean = cleanFilterUrl(url, routes.home.href())
        if (clean !== null) return redirect(clean, 303)
        const envId = session?.get?.("envId") as string | undefined
        const environments = (await runWithEnvs((r) => r.list)).map((e) => ({
          id: e.id,
          name: e.name,
          isDefault: e.isDefault
        }))
        const page = await loadRuns(url, envId ?? null)
        const { items, nextCursor } = encodeRuns(page)
        const filters = toFilters(parseFilter(url))
        const currentPath = url.pathname + url.search
        return render(
          <RunsPage
            runs={items}
            nextCursor={nextCursor}
            filters={filters}
            query={buildFilterQuery(filters)}
            environments={environments}
            activeEnvId={envId ?? null}
            currentPath={currentPath}
            currentUserRole={currentRole(auth)}
          />
        )
      }
    },

    // GET /chart — server-rendered scatter of runs (start × duration); hydrates.
    chart: {
      middleware: [...protect, policyUse("workflow", "list")],
      async handler({ auth, render, session, url }) {
        const clean = cleanFilterUrl(url, routes.chart.href())
        if (clean !== null) return redirect(clean, 303)
        const envId = session?.get?.("envId") as string | undefined
        const environments = (await runWithEnvs((r) => r.list)).map((e) => ({
          id: e.id,
          name: e.name,
          isDefault: e.isDefault
        }))
        const page = await loadChartRuns(url, envId ?? null)
        const { items, nextCursor } = encodeRuns(page)
        const filter = parseFilter(url)
        const filters = toFilters(filter)
        // Range: explicit filter bounds win; else span the data; else last 24h.
        const times = items
          .map((r) => r.startedAt)
          .filter((s): s is string => s !== null)
          .map((s) => Date.parse(s))
        const nowMs = Date.now()
        const fromMs = filter.from
          ? filter.from.getTime()
          : times.length > 0
          ? Math.min(...times)
          : nowMs - 24 * 3_600_000
        const toMs = filter.to
          ? filter.to.getTime()
          : times.length > 0
          ? Math.max(...times) + 1
          : nowMs
        const currentPath = url.pathname + url.search
        return render(
          <ChartPage
            runs={items}
            fromMs={fromMs}
            toMs={toMs}
            filters={filters}
            query={buildFilterQuery(filters)}
            truncated={nextCursor !== null}
            environments={environments}
            activeEnvId={envId ?? null}
            currentPath={currentPath}
            currentUserRole={currentRole(auth)}
          />
        )
      }
    },

    // /settings — configuration page. GET renders account info + logout + the
    // user list; POST (admin only) creates a new account.
    settings: {
      middleware: [...protect, policyUse("config", "settings")],
      async handler(context) {
        // requireAuthRedirect guarantees `ok` at runtime; narrow for the type.
        if (!context.auth.ok) return redirect(routes.login.href(), 303)
        const currentUser = context.auth.identity
        const isAdmin = currentUser.role === "admin"

        if (context.method === "POST") {
          const form = context.get(FormData)
          const intent = String(form?.get("intent") ?? "create")
          const ip = resolveClientIp(context.request)
          const userAgent = context.request.headers.get("user-agent")
          const flashTo = (key: "error" | "success", msg: string) => {
            context.session.flash(key, msg)
            return redirect(routes.settings.href(), 303)
          }

          if (intent === "delete") {
            const parsed = s.parseSafe(deleteUserSchema, form)
            if (!parsed.success) return flashTo("error", "Could not delete that account.")
            const targetId = UserId.make(parsed.value.id)
            if (targetId === currentUser.id) return flashTo("error", "You cannot delete your own account.")
            const result = await runtime.runPromise(
              Effect.gen(function*() {
                const repo = yield* AuthRepository
                const target = yield* repo.findById(targetId)
                if (target === null) return { _tag: "notFound" as const }
                if (target.role === "admin" && (yield* repo.countAdmins) <= 1) return { _tag: "lastAdmin" as const }
                yield* repo.deleteUser(targetId)
                return { _tag: "ok" as const, email: target.email }
              })
            )
            if (result._tag === "notFound") return flashTo("error", "Account not found.")
            if (result._tag === "lastAdmin") return flashTo("error", "Cannot delete the last admin.")
            await withAuth((r) =>
              r.recordAudit({ event: "account_deleted", userId: currentUser.id, email: result.email, ip, userAgent })
            )
            return flashTo("success", `Account ${result.email} deleted.`)
          }

          if (intent === "update") {
            const parsed = s.parseSafe(updateUserSchema, form)
            if (!parsed.success) {
              return flashTo("error", "Enter a valid role (and an 8+ character password if changing it).")
            }
            const targetId = UserId.make(parsed.value.id)
            const newRole = parsed.value.role as Role
            const newPassword = parsed.value.password
            if (newPassword !== "" && newPassword.length < 8) {
              return flashTo("error", "Password must be at least 8 characters.")
            }
            const result = await runtime.runPromise(
              Effect.gen(function*() {
                const repo = yield* AuthRepository
                const target = yield* repo.findById(targetId)
                if (target === null) return { _tag: "notFound" as const }
                if (target.role === "admin" && newRole === "user" && (yield* repo.countAdmins) <= 1) {
                  return { _tag: "lastAdmin" as const }
                }
                const passwordHash = newPassword !== "" ? yield* hashPassword(newPassword) : undefined
                yield* repo.updateUser({ id: targetId, role: newRole, passwordHash })
                return { _tag: "ok" as const, email: target.email }
              })
            )
            if (result._tag === "notFound") return flashTo("error", "Account not found.")
            if (result._tag === "lastAdmin") return flashTo("error", "Cannot demote the last admin.")
            await withAuth((r) =>
              r.recordAudit({ event: "account_updated", userId: currentUser.id, email: result.email, ip, userAgent })
            )
            return flashTo("success", `Account ${result.email} updated.`)
          }

          if (intent === "create-env") {
            const parsed = s.parseSafe(createEnvSchema, form)
            if (!parsed.success) {
              return flashTo(
                "error",
                "Enter a name, host, user (max 63 chars), password and database for the environment."
              )
            }
            const v = parsed.value
            const outcome = await runWithEnvs((repo) =>
              repo.create({
                name: v.name,
                host: v.host,
                ...(v.port !== "" ? { port: v.port } : {}),
                user: v.user,
                password: v.password,
                dbName: v.dbName,
                ssl: v.ssl === "true",
                isDefault: v.isDefault === "true"
              }).pipe(
                Effect.map((env) => ({ _tag: "ok" as const, env })),
                Effect.catchAllDefect(() => Effect.succeed({ _tag: "conflict" as const }))
              )
            )
            if (outcome._tag === "conflict") {
              return flashTo("error", "An environment with that name already exists.")
            }
            return flashTo("success", `Environment ${outcome.env.name} created.`)
          }

          if (intent === "set-default-env") {
            const parsed = s.parseSafe(envIdSchema, form)
            if (!parsed.success) return flashTo("error", "Could not update that environment.")
            await runWithEnvs((repo) => repo.update(parsed.value.envId, { isDefault: true }))
            return flashTo("success", "Default environment updated.")
          }

          if (intent === "delete-env") {
            const parsed = s.parseSafe(envIdSchema, form)
            if (!parsed.success) return flashTo("error", "Could not delete that environment.")
            await runWithEnvs((repo) => repo.delete(parsed.value.envId))
            if (context.session.get("envId") === parsed.value.envId) {
              context.session.unset("envId")
            }
            return flashTo("success", "Environment deleted.")
          }

          // ── API key management ──

          if (intent === "create-key") {
            const name = String(form?.get("name") ?? "").trim()
            if (name.length < 1 || name.length > 100) {
              return flashTo("error", "Enter a name between 1 and 100 characters.")
            }
            const result = await runtime.runPromise(
              Effect.gen(function*() {
                const repo = yield* ApiKeyRepository
                return yield* repo.create({ userId: currentUser.id, name })
              })
            )
            // Put the raw key in flash so the user can copy it once,
            // then redirect to the API Keys tab where the flash is displayed.
            context.session.flash("createdKey", result.rawKey)
            context.session.flash("createdKeyName", result.name)
            context.session.flash("success", `API key "${result.name}" created. Copy it now — you won't see it again.`)
            return redirect("/settings?tab=api-keys", 303)
          }

          if (intent === "revoke-key") {
            const keyId = String(form?.get("keyId") ?? "")
            if (!keyId) return flashTo("error", "Missing key id.")
            await runtime.runPromise(
              Effect.gen(function*() {
                const repo = yield* ApiKeyRepository
                return yield* repo.revoke(keyId)
              }).pipe(Effect.catchTag("ApiKeyNotFound", () => Effect.void))
            )
            context.session.flash("success", "API key revoked.")
            return redirect("/settings?tab=api-keys", 303)
          }

          // intent === "create"
          const parsed = s.parseSafe(createUserSchema, form)
          if (!parsed.success) {
            return flashTo("error", "Enter a valid email, a password of at least 8 characters, and a role.")
          }
          const email = decodeEmail(parsed.value.email)
          if (Option.isNone(email)) return flashTo("error", "Enter a valid email address.")
          const role = parsed.value.role as Role
          const outcome = await runtime.runPromise(
            Effect.gen(function*() {
              const repo = yield* AuthRepository
              const passwordHash = yield* hashPassword(parsed.value.password)
              return yield* repo.createUser({ email: email.value, passwordHash, role })
            }).pipe(
              Effect.map((user) => ({ _tag: "ok" as const, user })),
              Effect.catchTag("UserAlreadyExists", () => Effect.succeed({ _tag: "exists" as const }))
            )
          )
          if (outcome._tag === "exists") return flashTo("error", "An account with that email already exists.")
          await withAuth((r) =>
            r.recordAudit({
              event: "account_created",
              userId: currentUser.id,
              email: outcome.user.email,
              ip,
              userAgent
            })
          )
          return flashTo("success", `Account ${outcome.user.email} created.`)
        }

        const { activity, users } = await withAuth((r) =>
          Effect.all({
            users: r.listUsers,
            activity: isAdmin ? r.listRecentAudit(25) : Effect.succeed([])
          })
        )
        const adminCount = users.filter((u) => u.role === "admin").length
        const envId = context.session.get("envId") as string | undefined
        const environments = isAdmin
          ? await runWithEnvs((r) => r.list)
          : []
        const apiKeys = await runtime.runPromise(
          Effect.gen(function*() {
            const repo = yield* ApiKeyRepository
            return yield* repo.listForUser(currentUser.id)
          })
        )
        const error = context.session.get("error") as string | undefined
        const success = context.session.get("success") as string | undefined
        return context.render(
          <SettingsPage
            email={currentUser.email}
            role={currentUser.role}
            isAdmin={isAdmin}
            users={users.map((u) => ({
              id: u.id,
              email: u.email,
              role: u.role,
              lastLoginAt: u.lastLoginAt !== null ? fmtAt(u.lastLoginAt) : null,
              canDelete: u.id !== currentUser.id && !(u.role === "admin" && adminCount <= 1)
            }))}
            activity={activity.map((a) => ({
              event: a.event,
              email: a.email,
              ip: a.ipAddress,
              at: fmtAt(a.createdAt)
            }))}
            environments={environments.map((e) => ({
              id: e.id,
              name: e.name,
              host: e.host,
              port: e.port,
              user: e.user,
              dbName: e.dbName,
              ssl: e.ssl,
              isDefault: e.isDefault
            }))}
            activeEnvId={envId ?? null}
            currentUserRole={currentUser.role}
            tab={context.url.searchParams.get("tab") || "account"}
            error={error ?? null}
            success={success ?? null}
            apiKeys={apiKeys.map((k) => ({
              id: k.id,
              name: k.name,
              keyPrefix: k.keyPrefix,
              createdAt: fmtAt(k.createdAt),
              lastUsedAt: k.lastUsedAt !== null ? fmtAt(k.lastUsedAt) : null,
              expiresAt: k.expiresAt !== null ? fmtAt(k.expiresAt) : null
            }))}
            createdKey={context.session.get("createdKey") as string | undefined}
            createdKeyName={context.session.get("createdKeyName") as string | undefined}
          />
        )
      }
    },

    // GET /runs — paginated list as JSON; consumed by the hydrated "Load more".
    runs: {
      middleware: [...protect, policyUse("workflow", "list")],
      async handler({ session, url }) {
        const envId = session?.get?.("envId") as string | undefined
        const page = await loadRuns(url, envId ?? null)
        return Response.json(encodeRuns(page))
      }
    },

    // GET /runs/:messageId — server-rendered run detail page.
    runShow: {
      middleware: [...protect, policyUse("workflow", "detail")],
      async handler({ auth, params, render, session, url }) {
        const messageId = decodeMessageId(params.messageId)
        const envId = session?.get?.("envId") as string | undefined

        if (!envId) return new Response("No environment selected", { status: 404 })

        const result = await loadRunDetailWithEnv(envId, messageId)
        const environments = (await runWithEnvs((r) => r.list)).map((e) => ({
          id: e.id,
          name: e.name,
          isDefault: e.isDefault
        }))
        const currentPath = url.pathname + url.search

        if (result._tag === "Failure") {
          return new Response("Run not found", { status: 404 })
        }
        return render(
          <RunDetailPage
            run={encodeRunDetail(result.value.run)}
            environments={environments}
            activeEnvId={envId ?? null}
            currentPath={currentPath}
            currentUserRole={currentRole(auth)}
          />
        )
      }
    },

    // GET /runs/:messageId/children — sibling runs sharing the trace.
    runChildren: {
      middleware: [...protect, policyUse("workflow", "detail")],
      async handler({ params, session }) {
        const messageId = decodeMessageId(params.messageId)
        const envId = session?.get?.("envId") as string | undefined

        if (!envId) return Response.json({ items: [], nextCursor: null })

        const result = await loadChildrenWithEnv(envId, messageId)

        if (result._tag === "Failure") {
          return new Response("Run not found", { status: 404 })
        }
        return Response.json(encodeChildren(result.value.children))
      }
    },

    // GET /environments — JSON list of all configured environments.
    environments: {
      middleware: [...protect, policyUse("config", "environments")],
      async handler() {
        const envs = await runWithEnvs((r) => r.list)
        return Response.json(envs)
      }
    },

    // GET /overview — Cluster Overview page with live data from DB.
    overview: {
      middleware: [...protect, policyUse("cluster", "overview")],
      async handler({ auth, render, session, url }) {
        const envId = session?.get?.("envId") as string | undefined
        const environments = (await runWithEnvs((r) => r.list)).map((e) => ({
          id: e.id,
          name: e.name,
          isDefault: e.isDefault
        }))

        let initialSnapshot = null
        if (envId) {
          try {
            initialSnapshot = await loadOverviewSnapshot(envId)
          } catch {
            // Initial load failed — render with no snapshot; the SSE stream retries.
          }
        }

        const currentPath = url.pathname + url.search
        return render(
          <OverviewPage
            initialSnapshot={initialSnapshot}
            environments={environments}
            activeEnvId={envId ?? null}
            currentPath={currentPath}
            currentUserRole={currentRole(auth)}
          />
        )
      }
    },

    // GET /shards — Dedicated shard distribution page.
    shards: {
      middleware: [...protect, policyUse("cluster", "shards")],
      async handler({ auth, render, session, url }) {
        const envId = session?.get?.("envId") as string | undefined
        const environments = (await runWithEnvs((r) => r.list)).map((e) => ({
          id: e.id,
          name: e.name,
          isDefault: e.isDefault
        }))

        let initialSnapshot = null
        if (envId) {
          try {
            initialSnapshot = await loadOverviewSnapshot(envId)
          } catch {
            // Initial load failed
          }
        }

        const currentPath = url.pathname + url.search
        return render(
          <ShardsPage
            initialSnapshot={initialSnapshot}
            environments={environments}
            activeEnvId={envId ?? null}
            currentPath={currentPath}
            currentUserRole={currentRole(auth)}
          />
        )
      }
    },

    // GET /nodes — Dedicated nodes page (runner status, shards per node).
    nodes: {
      middleware: [...protect, policyUse("cluster", "nodes")],
      async handler({ auth, render, session, url }) {
        const envId = session?.get?.("envId") as string | undefined
        const environments = (await runWithEnvs((r) => r.list)).map((e) => ({
          id: e.id,
          name: e.name,
          isDefault: e.isDefault
        }))

        let initialSnapshot = null
        if (envId) {
          try {
            initialSnapshot = await loadOverviewSnapshot(envId)
          } catch {
            // Initial load failed
          }
        }

        const currentPath = url.pathname + url.search
        return render(
          <NodesPage
            initialSnapshot={initialSnapshot}
            environments={environments}
            activeEnvId={envId ?? null}
            currentPath={currentPath}
            currentUserRole={currentRole(auth)}
          />
        )
      }
    },

    // GET /executions — Read-only workflow executions list.
    executions: {
      middleware: [...protect, policyUse("workflow", "list")],
      async handler({ auth, render, session, url }) {
        const envId = session?.get?.("envId") as string | undefined
        const environments = (await runWithEnvs((r) => r.list)).map((e) => ({
          id: e.id,
          name: e.name,
          isDefault: e.isDefault
        }))

        let executions = null
        if (envId) {
          try {
            executions = await loadExecutionsWithEnv(envId)
          } catch {
            // Load failed
          }
        }

        const currentPath = url.pathname + url.search
        return render(
          <ExecutionsPage
            executions={executions}
            environments={environments}
            activeEnvId={envId ?? null}
            currentPath={currentPath}
            currentUserRole={currentRole(auth)}
          />
        )
      }
    },

    // GET /executions/:executionId — read-only detail for one execution.
    executionShow: {
      middleware: [...protect, policyUse("workflow", "detail")],
      async handler({ auth, params, render, session, url }) {
        const envId = session?.get?.("envId") as string | undefined
        if (!envId) return new Response("No environment selected", { status: 404 })

        const result = await loadExecutionDetailWithEnv(envId, params.executionId)
        const environments = (await runWithEnvs((r) => r.list)).map((e) => ({
          id: e.id,
          name: e.name,
          isDefault: e.isDefault
        }))
        const currentPath = url.pathname + url.search

        if (result._tag === "Failure") {
          return new Response("Execution not found", { status: 404 })
        }
        return render(
          <ExecutionDetailPage
            run={encodeRunDetail(result.value.run)}
            environments={environments}
            activeEnvId={envId}
            currentPath={currentPath}
            currentUserRole={currentRole(auth)}
          />
        )
      }
    },

    // GET /overview/stream — SSE endpoint for live overview snapshots (poll DB every 10s).
    overviewStream: {
      middleware: [...protect, policyUse("cluster", "overview")],
      async handler({ request, session }) {
        const envId = session?.get?.("envId") as string | undefined
        const encoder = new TextEncoder()
        let timer: ReturnType<typeof setInterval> | null = null
        let fetching = false

        const enqueue = (controller: ReadableStreamDefaultController<Uint8Array>, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
          } catch {
            // Stream may be closed
          }
        }

        const sendSnapshot = async (controller: ReadableStreamDefaultController<Uint8Array>) => {
          if (fetching || !envId) return
          fetching = true
          try {
            const snapshot = await loadOverviewSnapshot(envId)
            enqueue(controller, snapshot)
          } catch {
            // Query failed — stream continues, next tick will retry
          } finally {
            fetching = false
          }
        }

        const stream = new ReadableStream({
          start(controller) {
            // Send initial snapshot
            sendSnapshot(controller)

            // Poll every 10 seconds (the `fetching` guard prevents overlap)
            timer = setInterval(() => sendSnapshot(controller), 10_000)

            // Cleanup when cancelled
            request.signal.addEventListener("abort", () => {
              if (timer !== null) clearInterval(timer)
            })
          },
          cancel() {
            if (timer !== null) clearInterval(timer)
          }
        })

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive"
          }
        })
      }
    }
  }
})
