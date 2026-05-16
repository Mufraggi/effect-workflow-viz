import { Effect } from "effect"
import type { AuthUserId } from "../domain/AuthUserId.js"
import type { Session } from "../domain/Session.js"
import { SessionRepository } from "../repository/sessionRepository.js"

export class ListSessionsQuery extends Effect.Service<ListSessionsQuery>()("ListSessionsQuery", {
  effect: Effect.gen(function*() {
    const sessions = yield* SessionRepository

    const execute = (userId: AuthUserId): Effect.Effect<ReadonlyArray<Session>> => sessions.listActiveForUser(userId)

    return { execute } as const
  }),
  dependencies: [SessionRepository.Default]
}) {}
