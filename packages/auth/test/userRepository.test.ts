import { Effect, Layer, ManagedRuntime, Option } from "effect"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Email } from "../src/domain/Email.js"
import { EmailAlreadyTaken } from "../src/domain/errors.js"
import type { PasswordHash } from "../src/domain/PasswordHash.js"
import type { AuthUser } from "../src/domain/User.js"
import { UserRepository } from "../src/repository/userRepository.js"
import { authDbTestLayer } from "./SqliteTestHelper.js"

const EMAIL = "alice@example.com" as Email
const EMAIL_B = "bob@example.com" as Email
const HASH = "$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHQ$hash" as PasswordHash

describe("UserRepository (integration)", () => {
  let runtime: ManagedRuntime.ManagedRuntime<UserRepository, never>
  let seededUser: AuthUser

  beforeAll(async () => {
    const layer = UserRepository.DefaultWithoutDependencies.pipe(
      Layer.provide(authDbTestLayer)
    ) as Layer.Layer<UserRepository, never, never>
    runtime = ManagedRuntime.make(layer)
    seededUser = await runtime.runPromise(
      Effect.flatMap(UserRepository, (r) => r.create({ email: EMAIL, passwordHash: HASH, role: "user" }))
    )
  })

  afterAll(async () => {
    await runtime.dispose()
  })

  it("create returns a user with the correct fields", () => {
    expect(seededUser.email).toBe(EMAIL)
    expect(seededUser.role).toBe("user")
    expect(seededUser.lastLoginAt).toBeNull()
    expect(seededUser.id).toMatch(/^[a-z0-9]{16}$/)
  })

  it("create fails with EmailAlreadyTaken on duplicate email", async () => {
    const result = await runtime.runPromise(
      Effect.flatMap(UserRepository, (r) => r.create({ email: EMAIL, passwordHash: HASH, role: "user" })).pipe(
        Effect.either
      )
    )
    expect(result._tag).toBe("Left")
    if (result._tag === "Left") {
      expect(result.left).toBeInstanceOf(EmailAlreadyTaken)
    }
  })

  it("findByEmail returns the user with passwordHash", async () => {
    const result = await runtime.runPromise(
      Effect.flatMap(UserRepository, (r) => r.findByEmail(EMAIL))
    )
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.email).toBe(EMAIL)
      expect(result.value.passwordHash).toBe(HASH)
    }
  })

  it("findByEmail returns None for unknown email", async () => {
    const result = await runtime.runPromise(
      Effect.flatMap(UserRepository, (r) => r.findByEmail("unknown@example.com" as Email))
    )
    expect(Option.isNone(result)).toBe(true)
  })

  it("findById returns the user", async () => {
    const result = await runtime.runPromise(
      Effect.flatMap(UserRepository, (r) => r.findById(seededUser.id))
    )
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.id).toBe(seededUser.id)
      expect(result.value.email).toBe(EMAIL)
    }
  })

  it("findById returns None for unknown id", async () => {
    const result = await runtime.runPromise(
      Effect.flatMap(UserRepository, (r) => r.findById("aaaaaaaaaaaaaaaa" as typeof seededUser.id))
    )
    expect(Option.isNone(result)).toBe(true)
  })

  it("count returns the number of users", async () => {
    const before = await runtime.runPromise(
      Effect.flatMap(UserRepository, (r) => r.count())
    )
    await runtime.runPromise(
      Effect.flatMap(UserRepository, (r) => r.create({ email: EMAIL_B, passwordHash: HASH, role: "admin" }))
    )
    const after = await runtime.runPromise(
      Effect.flatMap(UserRepository, (r) => r.count())
    )
    expect(after).toBe(before + 1)
  })

  it("updateLastLogin sets last_login_at", async () => {
    const before = await runtime.runPromise(
      Effect.flatMap(UserRepository, (r) => r.findById(seededUser.id))
    )
    expect(Option.isSome(before) && before.value.lastLoginAt).toBeNull()

    await runtime.runPromise(
      Effect.flatMap(UserRepository, (r) => r.updateLastLogin(seededUser.id))
    )

    const after = await runtime.runPromise(
      Effect.flatMap(UserRepository, (r) => r.findById(seededUser.id))
    )
    expect(Option.isSome(after)).toBe(true)
    if (Option.isSome(after)) {
      expect(after.value.lastLoginAt).not.toBeNull()
    }
  })
})
