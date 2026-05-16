import { Effect } from "effect"
import type { SessionId } from "../domain/SessionId.js"
import { SessionRepository } from "../repository/sessionRepository.js"

export class LogoutCommand extends Effect.Service<LogoutCommand>()("LogoutCommand", {
  effect: Effect.gen(function*() {
    const sessions = yield* SessionRepository

    const execute = (sessionId: SessionId): Effect.Effect<void> => sessions.delete(sessionId)

    return { execute } as const
  }),
  dependencies: [SessionRepository.Default]
}) {}
