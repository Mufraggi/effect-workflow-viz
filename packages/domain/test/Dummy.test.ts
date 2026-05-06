import { describe, expect, it } from "vitest"
import { UserId } from "../src/index.js"

describe("domain", () => {
  it("brands a UserId", () => {
    const id = UserId.make("u_1")
    expect(id).toBe("u_1")
  })
})
