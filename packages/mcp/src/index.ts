/**
 * Thin helper that resolves an `envId` string to a ready-to-use
 * `WorkflowReader` or `OverviewReader` via `DbManager`.
 *
 * Both reader factories agree with the pattern used in the Remix loaders
 * (see packages/web/app/actions/controller.tsx).
 */
export * as EnvReader from "./EnvReader.js"

/**
 * list_executions — List workflow executions with optional filters.
 */
export * as McpServer from "./McpServer.js"

/**
 * HTTP middleware that validates `Authorization: Bearer <key>` against the
 * `ApiKeyRepository`, while also:
 * - Rate-limiting per IP (100 req / 60s sliding window)
 * - Handling /health and /health/ready endpoints directly (no auth required)
 *   so load-balancer probes always get a 200 without needing API keys.
 * - Logging every request with method, path, IP, key prefix, and duration.
 */
export * as auth from "./auth.js"

/**
 * Configurable sliding-window rate limiter keyed by IP address.
 *
 * Thread-safe: uses an Effect `Ref` to hold the state so concurrent accesses
 * are serialised inside Effect's runtime.
 */
export * as RateLimiter from "./RateLimiter.js"

/**
 * MCP server entry point — standalone mode.
 *
 * Starts a self-contained MCP server on its own port (default 3100).
 * This is useful for development and testing in isolation.
 *
 * For production, the MCP layer is merged into the web server on port 3000
 * (see packages/web/server.ts for the combined entry point).
 *
 * Usage:
 * ```bash
 * # Standalone MCP server on port 3100
 * pnpm dev
 *
 * # With custom port
 * MCP_PORT=3101 pnpm dev
 * ```
 */
export * as server from "./server.js"
