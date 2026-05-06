import { describe, expect, it } from "vitest"
import { ApiLive } from "../src/Api.js"

describe("api", () => {
  it("exposes ApiLive", () => {
    expect(ApiLive).toBeDefined()
  })
})
