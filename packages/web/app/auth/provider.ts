import { AuthRepository } from "@template/auth/AuthRepository"
import { verifyPassword } from "@template/auth/password"
import { Email } from "@template/domain/auth/Email"
import { User } from "@template/domain/auth/User"
import { Effect, Option, Schema } from "effect"
import { createCredentialsAuthProvider } from "remix/auth"
import * as s from "remix/data-schema"
import * as f from "remix/data-schema/form-data"
import { runtime } from "../data/runtime.js"

// Validate the submitted form shape with data-schema rather than reading raw
// FormData fields by hand (the skill's recommended pattern).
const loginSchema = f.object({
  email: f.field(s.defaulted(s.string(), "")),
  password: f.field(s.defaulted(s.string(), ""))
})

const decodeEmail = Schema.decodeUnknownOption(Email)

/**
 * The email/password login provider. `verify` normalizes the email, looks the
 * account up in the auth DB, and checks the scrypt hash in constant time —
 * returning the public `User` on success or `null` on any failure.
 */
export const passwordProvider = createCredentialsAuthProvider({
  parse(context) {
    return s.parse(loginSchema, context.get(FormData))
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
