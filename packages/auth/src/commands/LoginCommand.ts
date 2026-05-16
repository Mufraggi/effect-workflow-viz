import { Effect, Option } from "effect"
import { createHash } from "node:crypto"
import { alphabet, generateRandomString } from "oslo/crypto"
import type { AuthResult } from "../domain/AuthResult.js"
import type { Email } from "../domain/Email.js"
import { InvalidCredentials, RateLimitExceeded } from "../domain/errors.js"
import type { IpAddress } from "../domain/IpAddress.js"
import type { SessionToken } from "../domain/SessionToken.js"
import type { TokenHash } from "../domain/TokenHash.js"
import { LoginAttemptRepository } from "../repository/loginAttemptRepository.js"
import { SessionRepository } from "../repository/sessionRepository.js"
import { UserRepository } from "../repository/userRepository.js"
import type { PasswordVerificationError } from "../services/PasswordHasher.js"
import { PasswordHasher } from "../services/PasswordHasher.js"

const RATE_LIMIT_WINDOW_MINUTES = 15
const RATE_LIMIT_MAX_FAILURES = 10

const generateToken = (): SessionToken => generateRandomString(32, alphabet("a-z", "0-9")) as SessionToken

const hashToken = (token: SessionToken): TokenHash => createHash("sha256").update(token).digest("hex") as TokenHash

export class LoginCommand extends Effect.Service<LoginCommand>()("LoginCommand", {
  effect: Effect.gen(function*() {
    const users = yield* UserRepository
    const sessions = yield* SessionRepository
    const loginAttempts = yield* LoginAttemptRepository
    const hasher = yield* PasswordHasher

    const execute = (params: {
      email: Email
      password: string
      ipAddress: IpAddress | null
      userAgent: string | null
    }): Effect.Effect<
      AuthResult,
      InvalidCredentials | RateLimitExceeded | PasswordVerificationError
    > =>
      Effect.gen(function*() {
        if (params.ipAddress !== null) {
          const failures = yield* loginAttempts.countRecentFailures({
            ipAddress: params.ipAddress,
            windowMinutes: RATE_LIMIT_WINDOW_MINUTES
          })
          if (failures >= RATE_LIMIT_MAX_FAILURES) {
            return yield* Effect.fail(
              new RateLimitExceeded({ retryAfterSeconds: RATE_LIMIT_WINDOW_MINUTES * 60 })
            )
          }
        }

        const maybeUser = yield* users.findByEmail(params.email)
        if (Option.isNone(maybeUser)) {
          yield* recordFailure(loginAttempts, params.ipAddress)
          return yield* Effect.fail(new InvalidCredentials())
        }

        const userWithHash = maybeUser.value
        const valid = yield* hasher.verify(userWithHash.passwordHash, params.password)

        if (!valid) {
          yield* recordFailure(loginAttempts, params.ipAddress)
          return yield* Effect.fail(new InvalidCredentials())
        }

        if (params.ipAddress !== null) {
          yield* loginAttempts.record({ ipAddress: params.ipAddress, succeeded: true })
        }

        yield* users.updateLastLogin(userWithHash.id)

        const token = generateToken()
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        yield* sessions.create({
          tokenHash: hashToken(token),
          userId: userWithHash.id,
          expiresAt,
          userAgent: params.userAgent,
          ipAddress: params.ipAddress
        })

        const { passwordHash: _ph, ...user } = userWithHash
        return { user, token }
      })

    return { execute } as const
  }),
  dependencies: [
    UserRepository.Default,
    SessionRepository.Default,
    LoginAttemptRepository.Default,
    PasswordHasher.Default
  ]
}) {}

const recordFailure = (
  repo: LoginAttemptRepository,
  ipAddress: IpAddress | null
): Effect.Effect<void> => {
  if (ipAddress === null) return Effect.void
  return repo.record({ ipAddress, succeeded: false })
}
