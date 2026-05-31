import { AuthRepository } from "@template/auth/AuthRepository"
import { verifyPassword } from "@template/auth/password"
import { Email } from "@template/domain/auth/Email"
import { User } from "@template/domain/auth/User"
import { Effect, Option, Schema } from "effect"
import { createCredentialsAuthProvider } from "remix/auth"
import { runtime } from "../data/runtime.js"

interface Credentials {
  readonly email: string
  readonly password: string
}

const decodeEmail = Schema.decodeUnknownOption(Email)

/**
 * The email/password login provider. `verify` normalizes the email, looks the
 * account up in the auth DB, and checks the scrypt hash in constant time —
 * returning the public `User` on success or `null` on any failure.
 */
export const passwordProvider = createCredentialsAuthProvider<Credentials, User>({
  parse(context) {
    const form = context.get(FormData)
    return {
      email: String(form?.get("email") ?? ""),
      password: String(form?.get("password") ?? "")
    }
  },
  verify({ email, password }) {
    return runtime.runPromise(
      Effect.gen(function*() {
        const parsedEmail = decodeEmail(email)
        if (Option.isNone(parsedEmail)) return null
        const repo = yield* AuthRepository
        const found = yield* repo.findByEmail(parsedEmail.value)
        if (found === null) return null
        const ok = yield* verifyPassword(password, found.passwordHash)
        if (!ok) return null
        return new User({
          id: found.id,
          email: found.email,
          role: found.role,
          createdAt: found.createdAt
        })
      })
    )
  }
})
