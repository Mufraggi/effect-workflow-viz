import { AuthRepository } from "@template/auth/AuthRepository"
import type { User } from "@template/domain/auth/User"
import { EnvironmentRepository } from "@template/environments/EnvironmentRepository"
import { Effect } from "effect"
import { requireAuth } from "remix/middleware/auth"
import { redirect } from "remix/response/redirect"
import type { Middleware, RequestContext } from "remix/router"
import { runtime } from "../data/runtime.js"
import { routes } from "../routes.js"

const countUsers = () =>
  runtime.runPromise(
    Effect.gen(function*() {
      const repo = yield* AuthRepository
      return yield* repo.countUsers
    })
  )

/**
 * First-run gate: while no account exists, every guarded route is redirected to
 * the one-time `/setup` flow. Runs before `requireAuthRedirect` so an empty DB
 * sends users to setup rather than to login.
 */
export function setupGuard(): Middleware {
  return async (_context: RequestContext, next) => {
    if ((await countUsers()) === 0) return redirect(routes.setup.href(), 303)
    return next()
  }
}

/**
 * Seeds the session with the default environment when none is selected yet.
 *
 * Runs inside the `session()` scope (set on `protect`, after auth), so the write
 * is persisted to the cookie on the way out — exactly like the `selectEnv`
 * handler. Once seeded, every handler reads `session.get("envId")` and loads its
 * data, and the sidebar shows the default selected. An explicit choice via
 * `/select-env` overwrites it and takes precedence afterwards.
 */
export function seedDefaultEnv(): Middleware {
  return async (context: RequestContext, next) => {
    // session() runs earlier in the stack; cast to reach it (same approach as policyUse).
    const session = (context as unknown as {
      session: { get: (key: string) => unknown; set: (key: string, value: unknown) => void }
    }).session
    if (!session.get("envId")) {
      const def = await runtime.runPromise(
        Effect.flatMap(EnvironmentRepository, (r) => r.getDefault)
      )
      if (def) session.set("envId", def.id)
    }
    return next()
  }
}

/**
 * Protects a route: unauthenticated requests are redirected to `/login` with a
 * `returnTo` so they land back where they were after signing in.
 */
export function requireAuthRedirect() {
  return requireAuth<User>({
    onFailure(context) {
      const returnTo = encodeURIComponent(context.url.pathname + context.url.search)
      return redirect(`${routes.login.href()}?returnTo=${returnTo}`, 303)
    }
  })
}
