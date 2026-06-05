import { describe, expect, it } from "vitest"
import { millisToSnowflake, SNOWFLAKE_EPOCH, snowflakeToDate, snowflakeToMillis } from "../src/run/Snowflake.js"

describe("Snowflake", () => {
  it("round-trips a timestamp through millisToSnowflake/snowflakeToMillis", () => {
    const ms = Date.UTC(2026, 5, 1, 12, 30, 0)
    const id = millisToSnowflake(ms)
    expect(snowflakeToMillis(id)).toBe(ms)
    expect(snowflakeToDate(id).getTime()).toBe(ms)
  })

  it("ignores the low 22 machine/sequence bits", () => {
    const ms = Date.UTC(2026, 0, 1)
    const base = millisToSnowflake(ms)
    // Setting any of the low 22 bits must not change the decoded timestamp.
    expect(snowflakeToMillis(base | 0x3fffffn)).toBe(ms)
    expect(snowflakeToMillis(base | 1n)).toBe(ms)
  })

  it("decodes the epoch id to SNOWFLAKE_EPOCH", () => {
    expect(snowflakeToMillis(0n)).toBe(SNOWFLAKE_EPOCH)
    expect(SNOWFLAKE_EPOCH).toBe(Date.UTC(2025, 0, 1))
  })
})
