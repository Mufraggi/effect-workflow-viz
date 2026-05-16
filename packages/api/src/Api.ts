import { HttpApiBuilder } from "@effect/platform"
import { Api } from "@template/api-contract/Api"
import { Effect, Layer } from "effect"
import { AuthLive } from "./auth/AuthHandler.js"
import { RunsLive } from "./run/RunsHandler.js"

const HealthLive = HttpApiBuilder.group(Api, "health", (handlers) =>
  Effect.gen(function*() {
    yield* Effect.log("")
    return handlers.handle("ping", () => Effect.succeed({ ok: true }))
  }))

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(HealthLive),
  Layer.provide(RunsLive),
  Layer.provide(AuthLive)
)
