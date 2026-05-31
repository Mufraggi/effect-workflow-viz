import { Effect } from "effect"
import { Argon2id } from "oslo/password"

const argon2 = new Argon2id()

/**
 * Hash a plaintext password with Argon2id (via oslo). The returned string is the
 * standard `$argon2id$...` encoding, carrying its own salt and parameters.
 */
export const hashPassword = (plain: string): Effect.Effect<string> =>
  Effect.tryPromise(() => argon2.hash(plain)).pipe(Effect.orDie)

/**
 * Verify a plaintext password against a stored Argon2id hash (constant-time
 * inside oslo). Returns `false` on any malformed/invalid input.
 */
export const verifyPassword = (plain: string, stored: string): Effect.Effect<boolean> =>
  Effect.tryPromise(() => argon2.verify(stored, plain)).pipe(
    Effect.catchAll(() => Effect.succeed(false))
  )
