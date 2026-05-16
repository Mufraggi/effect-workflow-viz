import { Effect } from "effect"
import { createHash } from "node:crypto"
import { alphabet, generateRandomString } from "oslo/crypto"
import type { AuthResult } from "../domain/AuthResult.js"
import type { Email } from "../domain/Email.js"
import type { EmailAlreadyTaken } from "../domain/errors.js"
import type { SessionToken } from "../domain/SessionToken.js"
import type { TokenHash } from "../domain/TokenHash.js"
import { SessionRepository } from "../repository/sessionRepository.js"
import { UserRepository } from "../repository/userRepository.js"
import type { PasswordHashingError } from "../services/PasswordHasher.js"
import { PasswordHasher } from "../services/PasswordHasher.js"

const generateToken = (): SessionToken => generateRandomString(32, alphabet("a-z", "0-9")) as SessionToken

const hashToken = (token: SessionToken): TokenHash => createHash("sha256").update(token).digest("hex") as TokenHash

export class RegisterCommand extends Effect.Service<RegisterCommand>()("RegisterCommand", {
  effect: Effect.gen(function*() {
    const users = yield* UserRepository
    const sessions = yield* SessionRepository
    const hasher = yield* PasswordHasher

    const execute = (params: {
      email: Email
      password: string
      userAgent: string | null
    }): Effect.Effect<AuthResult, EmailAlreadyTaken | PasswordHashingError> =>
      Effect.gen(function*() {
        const passwordHash = yield* hasher.hash(params.password)

        const user = yield* users.create({
          email: params.email,
          passwordHash,
          role: "user"
        })

        const token = generateToken()
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        yield* sessions.create({
          tokenHash: hashToken(token),
          userId: user.id,
          expiresAt,
          userAgent: params.userAgent,
          ipAddress: null
        })

        return { user, token }
      })

    return { execute } as const
  }),
  dependencies: [
    UserRepository.Default,
    SessionRepository.Default,
    PasswordHasher.Default
  ]
}) {}
