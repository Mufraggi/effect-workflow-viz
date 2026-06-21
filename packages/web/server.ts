import "./app/env.js"
import "./app/env-check.js"
import { McpServer } from "@effect/ai"
import { HttpRouter } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { ApiKeyRepository } from "@template/auth/ApiKeyRepository"
import { AuthRepository } from "@template/auth/AuthRepository"
import { DbManager } from "@template/environments/DbManager"
import { EnvironmentRepository } from "@template/environments/EnvironmentRepository"
import { mcpAuthMiddleware } from "@template/mcp/auth"
import { EnvReader } from "@template/mcp/EnvReader"
import { ClusterToolsLayer, McpRegistrationLayer } from "@template/mcp/McpServer"
import { McpRateLimiter } from "@template/mcp/RateLimiter"
import { Config, Effect, Layer, Logger } from "effect"
import { createServer as createHttpServer } from "node:http"
import { createRequestListener } from "remix/node-fetch-server"
import { clientAddresses } from "./app/auth/client-ip.js"
import { handleHealth } from "./app/health.js"
import { router } from "./app/router.js"

// =========================================================================
// Shared app services (DbManager, Auth, Environments)
// =========================================================================
const AppServices = Layer.mergeAll(
  AuthRepository.Default,
  ApiKeyRepository.Default,
  EnvironmentRepository.Default,
  DbManager.Default,
  McpRateLimiter.Default
)

// =========================================================================
// MCP server — built with the same pipe pattern as the standalone server
// (proven to work). Listens on port 3100 (MCP_PORT).
// =========================================================================
const MCPLayer = McpRegistrationLayer.pipe(
  Layer.provide(ClusterToolsLayer),
  Layer.merge(HttpRouter.Default.serve(
    mcpAuthMiddleware as unknown as Parameters<typeof HttpRouter.Default.serve>[0]
  )),
  Layer.provide(EnvReader.Default),
  Layer.provide(
    McpServer.layerHttp({
      name: "Effect Cluster MCP",
      version: "0.1.0",
      path: "/sse"
    })
  ),
  Layer.provide(
    NodeHttpServer.layerConfig(createHttpServer, {
      port: Config.integer("MCP_PORT").pipe(Config.withDefault(3100)),
      host: Config.string("MCP_HOST").pipe(Config.withDefault("0.0.0.0"))
    })
  ),
  Layer.provide(Logger.replace(Logger.defaultLogger, Logger.prettyLogger({ stderr: true }))),
  Layer.provide(AppServices)
) as unknown as Layer.Layer<never, never, never>

const MCPProgram = Layer.launch(MCPLayer).pipe(
  Effect.tapError((err) => Effect.logError("MCP server failed", { error: String(err) })),
  Effect.forkDaemon,
  Effect.tap(() => Effect.logInfo(`MCP server on ${process.env.MCP_PORT ?? "3100"}`))
)

// =========================================================================
// Remix server — standard Node http server on port 3000
// =========================================================================
const PORT = Number(process.env.PORT ?? 3000)

const remixServer = createHttpServer(
  createRequestListener(async (request, client) => {
    const health = await handleHealth(request)
    if (health) return health
    if (client?.address) clientAddresses.set(request, client.address)
    return router.fetch(request)
  })
)

// =========================================================================
// Entry point: start both servers + graceful shutdown
// =========================================================================
Effect.gen(function*() {
  // Fork MCP first (it's an Effect fiber)
  yield* MCPProgram

  // Start Remix server
  yield* Effect.async<void>((resume) => {
    remixServer.listen(PORT, () => resume(Effect.void))
  })
  yield* Effect.logInfo(`web server listening at http://localhost:${PORT}`)

  // Wait for shutdown signal
  yield* Effect.async<void>((resume) => {
    const onSignal = () => resume(Effect.void)
    process.on("SIGTERM", onSignal)
    process.on("SIGINT", onSignal)
  })
  yield* Effect.logInfo("Shutting down gracefully...")

  // Shutdown: close Remix server
  yield* Effect.async<void>((resume) => {
    remixServer.close(() => resume(Effect.void))
  })
  yield* Effect.logInfo("Remix server closed.")

  yield* Effect.logInfo("Goodbye.")
  process.exit(0)
}).pipe(NodeRuntime.runMain)
