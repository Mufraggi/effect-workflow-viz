import { HttpApiBuilder } from "@effect/platform"
import { Api } from "@template/api-contract"
import { Effect, Layer } from "effect"

const HealthLive = HttpApiBuilder.group(Api, "health", (handlers) =>
  Effect.gen(function*() {
    yield* Effect.log("")
    return handlers.handle("ping", () => Effect.succeed({ ok: true }))
  }))

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(HealthLive)
)
