import { Effect, Layer, ManagedRuntime, Option } from "effect"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Email } from "../src/domain/Email.js"
import type { IpAddress } from "../src/domain/IpAddress.js"
import type { PasswordHash } from "../src/domain/PasswordHash.js"
import type { Session } from "../src/domain/Session.js"
import type { TokenHash } from "../src/domain/TokenHash.js"
import type { AuthUser } from "../src/domain/User.js"
import { SessionRepository } from "../src/repository/sessionRepository.js"
import { UserRepository } from "../src/repository/userRepository.js"
import { authDbTestLayer } from "./SqliteTestHelper.js"

const EMAIL = "session-user@example.com" as Email
const HASH = "$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHQ$hash" as PasswordHash
const TOKEN_A = "a".repeat(64) as TokenHash
const TOKEN_B = "b".repeat(64) as TokenHash
const TOKEN_C = "c".repeat(64) as TokenHash
const IP = "127.0.0.1" as IpAddress

const futureDate = () => new Date(Date.now() + 3_600_000)
const pastDate = () => new Date(Date.now() - 1_000)

describe("SessionRepository (integration)", () => {
  let runtime: ManagedRuntime.ManagedRuntime<UserRepository | SessionRepository, never>
  let user: AuthUser
  let session: Session

  beforeAll(async () => {
    const layer = Layer.mergeAll(
      UserRepository.DefaultWithoutDependencies,
      SessionRepository.DefaultWithoutDependencies
    ).pipe(Layer.provide(authDbTestLayer)) as Layer.Layer<UserRepository | SessionRepository, never, never>

    runtime = ManagedRuntime.make(layer)

    user = await runtime.runPromise(
      Effect.flatMap(UserRepository, (r) => r.create({ email: EMAIL, passwordHash: HASH, role: "user" }))
    )

    session = await runtime.runPromise(
      Effect.flatMap(SessionRepository, (r) =>
        r.create({
          tokenHash: TOKEN_A,
          userId: user.id,
          expiresAt: futureDate(),
          userAgent: "vitest",
          ipAddress: IP
        }))
    )
  })

  afterAll(async () => {
    await runtime.dispose()
  })

  it("create returns a session with correct fields", () => {
    expect(session.userId).toBe(user.id)
    expect(session.userAgent).toBe("vitest")
    expect(session.ipAddress).toBe(IP)
    expect(session.id).toMatch(/^[a-z0-9]{16}$/)
  })

  it("findByTokenHash returns the session", async () => {
    const result = await runtime.runPromise(
      Effect.flatMap(SessionRepository, (r) => r.findByTokenHash(TOKEN_A))
    )
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.id).toBe(session.id)
    }
  })

  it("findByTokenHash returns None for unknown token", async () => {
    const result = await runtime.runPromise(
      Effect.flatMap(SessionRepository, (r) => r.findByTokenHash("0".repeat(64) as TokenHash))
    )
    expect(Option.isNone(result)).toBe(true)
  })

  it("listActiveForUser returns active sessions", async () => {
    await runtime.runPromise(
      Effect.flatMap(SessionRepository, (r) =>
        r.create({
          tokenHash: TOKEN_B,
          userId: user.id,
          expiresAt: futureDate(),
          userAgent: null,
          ipAddress: null
        }))
    )
    const sessions = await runtime.runPromise(
      Effect.flatMap(SessionRepository, (r) => r.listActiveForUser(user.id))
    )
    expect(sessions.length).toBeGreaterThanOrEqual(2)
    expect(sessions.every((s) => s.userId === user.id)).toBe(true)
  })

  it("touch updates expires_at and last_used_at", async () => {
    const newExpiry = new Date(Date.now() + 7_200_000)
    await runtime.runPromise(
      Effect.flatMap(SessionRepository, (r) => r.touch(session.id, newExpiry))
    )
    const updated = await runtime.runPromise(
      Effect.flatMap(SessionRepository, (r) => r.findByTokenHash(TOKEN_A))
    )
    expect(Option.isSome(updated)).toBe(true)
    if (Option.isSome(updated)) {
      expect(updated.value.expiresAt.getTime()).toBeCloseTo(newExpiry.getTime(), -3)
    }
  })

  it("delete removes the session", async () => {
    const created = await runtime.runPromise(
      Effect.flatMap(SessionRepository, (r) =>
        r.create({
          tokenHash: TOKEN_C,
          userId: user.id,
          expiresAt: futureDate(),
          userAgent: null,
          ipAddress: null
        }))
    )
    await runtime.runPromise(
      Effect.flatMap(SessionRepository, (r) => r.delete(created.id))
    )
    const result = await runtime.runPromise(
      Effect.flatMap(SessionRepository, (r) => r.findByTokenHash(TOKEN_C))
    )
    expect(Option.isNone(result)).toBe(true)
  })

  it("deleteExpired removes only expired sessions and returns count", async () => {
    const EMAIL2 = "expired-user@example.com" as Email
    const user2 = await runtime.runPromise(
      Effect.flatMap(UserRepository, (r) => r.create({ email: EMAIL2, passwordHash: HASH, role: "user" }))
    )
    const EXPIRED_TOKEN = "e".repeat(64) as TokenHash
    await runtime.runPromise(
      Effect.flatMap(SessionRepository, (r) =>
        r.create({
          tokenHash: EXPIRED_TOKEN,
          userId: user2.id,
          expiresAt: pastDate(),
          userAgent: null,
          ipAddress: null
        }))
    )
    const deleted = await runtime.runPromise(
      Effect.flatMap(SessionRepository, (r) => r.deleteExpired())
    )
    expect(deleted).toBeGreaterThanOrEqual(1)
    const result = await runtime.runPromise(
      Effect.flatMap(SessionRepository, (r) => r.findByTokenHash(EXPIRED_TOKEN))
    )
    expect(Option.isNone(result)).toBe(true)
  })

  it("deleteAllForUser removes all sessions for that user", async () => {
    const EMAIL3 = "deleteme@example.com" as Email
    const user3 = await runtime.runPromise(
      Effect.flatMap(UserRepository, (r) => r.create({ email: EMAIL3, passwordHash: HASH, role: "user" }))
    )
    const T1 = "1".repeat(64) as TokenHash
    const T2 = "2".repeat(64) as TokenHash
    await runtime.runPromise(
      Effect.all([
        Effect.flatMap(
          SessionRepository,
          (r) =>
            r.create({ tokenHash: T1, userId: user3.id, expiresAt: futureDate(), userAgent: null, ipAddress: null })
        ),
        Effect.flatMap(
          SessionRepository,
          (r) =>
            r.create({ tokenHash: T2, userId: user3.id, expiresAt: futureDate(), userAgent: null, ipAddress: null })
        )
      ])
    )
    await runtime.runPromise(
      Effect.flatMap(SessionRepository, (r) => r.deleteAllForUser(user3.id))
    )
    const remaining = await runtime.runPromise(
      Effect.flatMap(SessionRepository, (r) => r.listActiveForUser(user3.id))
    )
    expect(remaining.length).toBe(0)
  })
})
