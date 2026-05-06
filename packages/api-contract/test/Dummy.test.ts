import { describe, expect, it } from "vitest"
import { Api } from "../src/index.js"

describe("api-contract", () => {
  it("exposes the Api class", () => {
    expect(Api).toBeDefined()
  })
})
