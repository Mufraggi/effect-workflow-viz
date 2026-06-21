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

import { McpServer } from "@effect/ai"
import { HttpRouter } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Config, Effect, Layer, Logger } from "effect"
import { createServer } from "node:http"
import { EnvReader } from "./EnvReader.js"
import { ClusterToolsLayer, McpRegistrationLayer } from "./McpServer.js"

const ProgramLayer = McpRegistrationLayer.pipe(
  Layer.provide(ClusterToolsLayer),
  Layer.merge(HttpRouter.Default.serve()),
  Layer.provide(EnvReader.Default),
  Layer.provide(
    McpServer.layerHttp({
      name: "Effect Cluster MCP",
      version: "0.1.0",
      path: "/sse"
    })
  ),
  Layer.provide(
    NodeHttpServer.layerConfig(createServer, {
      port: Config.integer("MCP_PORT").pipe(Config.withDefault(3100)),
      host: Config.string("MCP_HOST").pipe(Config.withDefault("0.0.0.0"))
    })
  ),
  Layer.provide(Logger.replace(Logger.defaultLogger, Logger.prettyLogger({ stderr: true })))
)

Layer.launch(ProgramLayer).pipe(
  Effect.tapError((error) => Effect.logError("MCP server failed to start", { error: String(error) })),
  Effect.tap(() => Effect.logInfo(`MCP server — port=${process.env.MCP_PORT ?? "3100"}, path=/sse`)),
  NodeRuntime.runMain
)
