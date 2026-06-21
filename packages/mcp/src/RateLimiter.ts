import { HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Effect, Option, Ref } from "effect"

/**
 * Configurable sliding-window rate limiter keyed by IP address.
 *
 * Thread-safe: uses an Effect `Ref` to hold the state so concurrent accesses
 * are serialised inside Effect's runtime.
 */
export class McpRateLimiter extends Effect.Service<McpRateLimiter>()("McpRateLimiter", {
  effect: Effect.gen(function*() {
    /** Per-IP request timestamps (ms) */
    const state = yield* Ref.make(new Map<string, Array<number>>())

    const windowMs = 60_000
    const maxRequests = 100

    const check = (ip: string): Effect.Effect<boolean> =>
      Ref.updateAndGet(state, (map) => {
        const now = Date.now()
        const cutoff = now - windowMs
        const timestamps = (map.get(ip) ?? []).filter((t) => t > cutoff)
        timestamps.push(now)
        const next = new Map(map)
        if (timestamps.length > maxRequests) {
          // Still store, but signal denial
          next.set(ip, timestamps)
        } else {
          next.set(ip, timestamps)
        }
        return next
      }).pipe(
        Effect.map((map) => {
          const timestamps = map.get(ip) ?? []
          return timestamps.length <= maxRequests
        })
      )

    /**
     * HTTP middleware handler: checks the client IP and returns 429 if the
     * rate limit is exceeded, or `void` to continue the request.
     */
    const handler = Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      const ip = request.remoteAddress.pipe(
        Option.getOrElse(() => request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? "unknown")
      )
      const ok = yield* check(ip)
      if (!ok) {
        return yield* HttpServerResponse.fromWeb(
          new Response(JSON.stringify({ error: "Too Many Requests" }), {
            status: 429,
            headers: {
              "content-type": "application/json",
              "retry-after": "60"
            }
          })
        )
      }
    })

    return { check, handler } as const
  })
}) {}
