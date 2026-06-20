import { SqlClient } from "@effect/sql"
import { ping } from "@template/database/Health"
import { DbManager } from "@template/environments/DbManager"
import { EnvironmentRepository } from "@template/environments/EnvironmentRepository"
import { Effect } from "effect"
import { runtime } from "./data/runtime.js"

/**
 * Readiness Effect: probe the *default* environment's Postgres with a `SELECT 1`.
 *
 * Postgres is no longer a fixed singleton — each environment carries its own
 * connection, resolved lazily through `DbManager`. So readiness pings whichever
 * environment is marked default. If none is configured yet (first run, before
 * any environment exists) there is nothing to probe: the process is up and can
 * serve the setup UI, so we report ready.
 */
const readiness = Effect.gen(function*() {
  const envRepo = yield* EnvironmentRepository
  const env = yield* envRepo.getDefault
  if (env === null) return

  const db = yield* DbManager
  const client = yield* db.getClient(env.id)
  yield* ping.pipe(Effect.provideService(SqlClient.SqlClient, client))
})

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  })

/**
 * Infrastructure health endpoints, handled in `server.ts` *before* the Remix
 * router so they bypass the session/auth/form-data middleware — they need no
 * cookies, stay cheap, and never require authentication.
 *
 *  - `GET /health`        liveness: the process is up and serving. Always 200.
 *  - `GET /health/ready`  readiness: the workflow Postgres answers a `SELECT 1`.
 *                         200 when reachable, 503 otherwise — so an orchestrator
 *                         can pull the instance out of rotation on a DB outage
 *                         without restarting it (that's what liveness is for).
 *
 * Returns `null` for any other path, letting the caller fall through to the router.
 */
export async function handleHealth(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url)

  if (pathname === "/health") {
    return json(200, { status: "ok" })
  }

  if (pathname === "/health/ready") {
    try {
      // The AbortSignal is the hard outer bound: it covers acquiring a pooled
      // connection too (a TCP connect to an unreachable host can block far
      // longer than the query-level timeout inside `ping`). Aborting interrupts
      // the fiber so the request fails fast with a 503.
      await runtime.runPromise(readiness, { signal: AbortSignal.timeout(3000) })
      return json(200, { status: "ready" })
    } catch {
      return json(503, { status: "unavailable", reason: "database unreachable" })
    }
  }

  return null
}
