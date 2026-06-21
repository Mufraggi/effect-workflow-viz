import type { HttpMiddleware } from "@effect/platform"
import { HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { ApiKeyRepository } from "@template/auth/ApiKeyRepository"
import { Effect, Either, Option } from "effect"
import { McpRateLimiter } from "./RateLimiter.js"

/**
 * HTTP middleware that validates `Authorization: Bearer <key>` against the
 * `ApiKeyRepository`, while also:
 * - Rate-limiting per IP (100 req / 60s sliding window)
 * - Handling /health and /health/ready endpoints directly (no auth required)
 *   so load-balancer probes always get a 200 without needing API keys.
 * - Logging every request with method, path, IP, key prefix, and duration.
 */
export const mcpAuthMiddleware: HttpMiddleware.HttpMiddleware = (app) =>
  Effect.gen(function*() {
    const startedAt = Date.now()
    const request = yield* HttpServerRequest.HttpServerRequest
    const { pathname } = new URL(request.url, "http://localhost")
    const method = request.method
    const rawIp = Option.getOrUndefined(request.remoteAddress)
    const ip = rawIp
      ? (rawIp.startsWith("::ffff:") ? rawIp.slice(7) : rawIp)
      : (request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? "unknown")

    // Rate limit check
    const limiter = yield* McpRateLimiter
    const maybeLimited = yield* limiter.handler
    if (maybeLimited) {
      yield* Effect.logInfo("MCP rate limited", { method, path: pathname, ip })
      return maybeLimited
    }

    // Health endpoints — handled directly, no auth required
    if (pathname === "/health" || pathname === "/health/ready") {
      const status = pathname === "/health/ready" ? "ready" : "ok"
      yield* Effect.logInfo("MCP health check", { method, path: pathname, ip, status })
      return yield* HttpServerResponse.fromWeb(
        new Response(JSON.stringify({ status }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    }

    // Auth
    const authHeader = request.headers["authorization"] ?? ""

    if (!authHeader.startsWith("Bearer ")) {
      yield* Effect.logWarning("MCP auth: missing Bearer token", { method, path: pathname, ip })
      return yield* HttpServerResponse.fromWeb(
        new Response("Unauthorized: missing Bearer token", { status: 401 })
      )
    }

    const rawKey = authHeader.slice("Bearer ".length).trim()
    const keyPrefix = rawKey.slice(0, 8)

    if (!rawKey.startsWith("sk_")) {
      yield* Effect.logWarning("MCP auth: invalid key format", { method, path: pathname, ip, keyPrefix })
      return yield* HttpServerResponse.fromWeb(
        new Response("Unauthorized: invalid key format", { status: 401 })
      )
    }

    const repo = yield* ApiKeyRepository
    const result = yield* Effect.either(repo.validate(rawKey))

    if (Either.isRight(result)) {
      const duration = Date.now() - startedAt
      yield* Effect.logInfo("MCP request", { method, path: pathname, ip, keyPrefix, durationMs: duration })
      return yield* app
    }

    const error = result.left
    if (error._tag === "ApiKeyNotFound") {
      yield* Effect.logWarning("MCP auth: key not found", { method, path: pathname, ip, keyPrefix })
      return yield* HttpServerResponse.fromWeb(
        new Response("Unauthorized: key not found", { status: 401 })
      )
    }

    if (error._tag === "ApiKeyRevoked") {
      yield* Effect.logWarning("MCP auth: key revoked or expired", { method, path: pathname, ip, keyPrefix })
      return yield* HttpServerResponse.fromWeb(
        new Response("Unauthorized: key revoked or expired", { status: 401 })
      )
    }

    yield* Effect.logWarning("MCP auth: unknown error", { method, path: pathname, ip, keyPrefix })
    return yield* HttpServerResponse.fromWeb(
      new Response("Unauthorized", { status: 401 })
    )
  })
