import { Effect, Schema } from "effect"
import { Argon2id } from "oslo/password"
import type { PasswordHash } from "../domain/PasswordHash.js"

export class PasswordHashingError extends Schema.TaggedError<PasswordHashingError>()(
  "PasswordHashingError",
  { message: Schema.String }
) {}

export class PasswordVerificationError extends Schema.TaggedError<PasswordVerificationError>()(
  "PasswordVerificationError",
  { message: Schema.String }
) {}

export class PasswordHasher extends Effect.Service<PasswordHasher>()("@template/PasswordHasher", {
  effect: Effect.gen(function*() {
    yield* Effect.log("")
    const argon2 = new Argon2id()

    const hash = (password: string): Effect.Effect<PasswordHash, PasswordHashingError> =>
      Effect.tryPromise({
        try: () => argon2.hash(password),
        catch: (e) => new PasswordHashingError({ message: e instanceof Error ? e.message : String(e) })
      }).pipe(Effect.map((h) => h as PasswordHash))

    const verify = (hash: PasswordHash, password: string): Effect.Effect<boolean, PasswordVerificationError> =>
      Effect.tryPromise({
        try: () => argon2.verify(hash, password),
        catch: (e) => new PasswordVerificationError({ message: e instanceof Error ? e.message : String(e) })
      })

    return { hash, verify } as const
  })
}) {}
