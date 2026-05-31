import { AuthRepository } from "@template/auth/AuthRepository"
import type { User } from "@template/domain/auth/User"
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
