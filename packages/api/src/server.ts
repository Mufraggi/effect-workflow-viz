import { HttpApiBuilder, HttpMiddleware, HttpServer } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { PgLive } from "@template/database/PgLive"
import { Layer } from "effect"
import { createServer } from "node:http"
import { ApiLive } from "./Api.js"

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(ApiLive),
  Layer.provide(
    HttpApiBuilder.middlewareCors({
      allowedOrigins: ["http://localhost:5173"],
      allowedMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "traceparent", "tracestate", "b3"],
      credentials: true
    })
  ),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
  Layer.provide(PgLive)
)

Layer.launch(HttpLive).pipe(
  NodeRuntime.runMain
)
