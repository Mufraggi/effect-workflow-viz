import { Forbidden } from "@template/domain/auth/Forbidden"
import type { Role } from "@template/domain/auth/Role"
import { Effect } from "effect"
import type { Middleware, RequestContext } from "remix/router"
import { authorize } from "./ClusterPolicies.js"

/**
 * Policy-enforcement middleware. Must be placed AFTER `setupGuard` and
 * `requireAuthRedirect` in the middleware chain so that `context.auth` is
 * guaranteed to be present and valid.
 *
 * Order: [setupGuard, requireAuthRedirect, policyUse("entity","action")]
 */
export function policyUse(entity: string, action: string): Middleware {
  return async (context: RequestContext, next) => {
    // requireAuthRedirect runs before this middleware, so context.auth is guaranteed.
    const a = (context as unknown as Record<string, unknown>).auth as { ok: true; identity: { role: Role } } | undefined
    if (!a?.ok) {
      return new Response("Forbidden", { status: 403 })
    }

    const result = await Effect.runPromise(
      authorize(a.identity.role, entity, action).pipe(
        Effect.catchTag("Forbidden", (err) => Effect.succeed(err))
      )
    )

    if (result instanceof Forbidden) {
      return new Response(
        JSON.stringify({ error: result.reason }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    }

    return next()
  }
}
