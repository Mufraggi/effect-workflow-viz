import { Effect } from "effect"
import type { AuthUserId } from "../domain/AuthUserId.js"
import type { SessionId } from "../domain/SessionId.js"
import { SessionRepository } from "../repository/sessionRepository.js"

export class DeleteSessionCommand extends Effect.Service<DeleteSessionCommand>()("DeleteSessionCommand", {
  effect: Effect.gen(function*() {
    const sessions = yield* SessionRepository

    const execute = (sessionId: SessionId, requestingUserId: AuthUserId): Effect.Effect<void> =>
      Effect.gen(function*() {
        const active = yield* sessions.listActiveForUser(requestingUserId)
        const owned = active.some((s) => s.id === sessionId)
        if (!owned) return
        yield* sessions.delete(sessionId)
      })

    return { execute } as const
  }),
  dependencies: [SessionRepository.Default]
}) {}
