import { describe, expect, it } from "vitest"
import { PgLive } from "../src/index.js"

describe("database", () => {
  it("exposes a PgLive layer", () => {
    expect(PgLive).toBeDefined()
  })
})
