import { Effect, Layer, ManagedRuntime } from "effect"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { IpAddress } from "../src/domain/IpAddress.js"
import { LoginAttemptRepository } from "../src/repository/loginAttemptRepository.js"
import { authDbTestLayer } from "./SqliteTestHelper.js"

const IP_A = "10.0.0.1" as IpAddress
const IP_B = "192.168.1.1" as IpAddress

describe("LoginAttemptRepository (integration)", () => {
  let runtime: ManagedRuntime.ManagedRuntime<LoginAttemptRepository, never>

  beforeAll(async () => {
    const layer = LoginAttemptRepository.DefaultWithoutDependencies.pipe(
      Layer.provide(authDbTestLayer)
    ) as Layer.Layer<LoginAttemptRepository, never, never>
    runtime = ManagedRuntime.make(layer)
  })

  afterAll(async () => {
    await runtime.dispose()
  })

  it("countRecentFailures returns 0 when there are no attempts", async () => {
    const count = await runtime.runPromise(
      Effect.flatMap(LoginAttemptRepository, (r) => r.countRecentFailures({ ipAddress: IP_A, windowMinutes: 15 }))
    )
    expect(count).toBe(0)
  })

  it("record stores a failed attempt and countRecentFailures sees it", async () => {
    await runtime.runPromise(
      Effect.flatMap(LoginAttemptRepository, (r) => r.record({ ipAddress: IP_A, succeeded: false }))
    )
    const count = await runtime.runPromise(
      Effect.flatMap(LoginAttemptRepository, (r) => r.countRecentFailures({ ipAddress: IP_A, windowMinutes: 15 }))
    )
    expect(count).toBe(1)
  })

  it("successful attempts are not counted as failures", async () => {
    await runtime.runPromise(
      Effect.flatMap(LoginAttemptRepository, (r) => r.record({ ipAddress: IP_A, succeeded: true }))
    )
    const count = await runtime.runPromise(
      Effect.flatMap(LoginAttemptRepository, (r) => r.countRecentFailures({ ipAddress: IP_A, windowMinutes: 15 }))
    )
    expect(count).toBe(1)
  })

  it("failures from a different IP do not affect the count", async () => {
    await runtime.runPromise(
      Effect.flatMap(LoginAttemptRepository, (r) => r.record({ ipAddress: IP_B, succeeded: false }))
    )
    const countA = await runtime.runPromise(
      Effect.flatMap(LoginAttemptRepository, (r) => r.countRecentFailures({ ipAddress: IP_A, windowMinutes: 15 }))
    )
    const countB = await runtime.runPromise(
      Effect.flatMap(LoginAttemptRepository, (r) => r.countRecentFailures({ ipAddress: IP_B, windowMinutes: 15 }))
    )
    expect(countA).toBe(1)
    expect(countB).toBe(1)
  })

  it("attempts outside the time window are not counted", async () => {
    const count = await runtime.runPromise(
      Effect.flatMap(LoginAttemptRepository, (r) => r.countRecentFailures({ ipAddress: IP_A, windowMinutes: 0 }))
    )
    expect(count).toBe(0)
  })

  it("accumulates multiple failures for the same IP", async () => {
    await runtime.runPromise(
      Effect.all([
        Effect.flatMap(LoginAttemptRepository, (r) => r.record({ ipAddress: IP_A, succeeded: false })),
        Effect.flatMap(LoginAttemptRepository, (r) => r.record({ ipAddress: IP_A, succeeded: false }))
      ])
    )
    const count = await runtime.runPromise(
      Effect.flatMap(LoginAttemptRepository, (r) => r.countRecentFailures({ ipAddress: IP_A, windowMinutes: 15 }))
    )
    expect(count).toBe(3)
  })
})
