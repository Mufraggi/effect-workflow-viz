import { Authorization } from "@template/api-contract/AuthGroup"
import { sessionRepository, userRepository } from "@template/auth"
import { SessionNotFound } from "@template/auth/domain/errors"
import type { TokenHash } from "@template/auth/domain/TokenHash"
import { Effect, Layer, Option, Redacted } from "effect"
import { createHash } from "node:crypto"

const hashToken = (token: string): TokenHash => createHash("sha256").update(token).digest("hex") as TokenHash

export const AuthorizationLive: Layer.Layer<
  Authorization,
  never,
  userRepository.UserRepository | sessionRepository.SessionRepository
> = Layer.effect(
  Authorization,
  Effect.gen(function*() {
    const sessions = yield* sessionRepository.SessionRepository
    const users = yield* userRepository.UserRepository

    return {
      bearer: (redacted: Redacted.Redacted<string>) =>
        Effect.gen(function*() {
          const tokenHash = hashToken(Redacted.value(redacted))
          const maybeSession = yield* sessions.findByTokenHash(tokenHash)

          if (Option.isNone(maybeSession)) {
            return yield* Effect.fail(new SessionNotFound({ userId: null }))
          }

          const session = maybeSession.value

          if (session.expiresAt < new Date()) {
            yield* sessions.delete(session.id)
            return yield* Effect.fail(new SessionNotFound({ userId: session.userId }))
          }

          const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          yield* sessions.touch(session.id, newExpiry)

          const maybeUser = yield* users.findById(session.userId)
          if (Option.isNone(maybeUser)) {
            return yield* Effect.fail(new SessionNotFound({ userId: session.userId }))
          }

          return { user: maybeUser.value, session }
        })
    }
  })
)
