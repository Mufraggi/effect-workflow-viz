import { mergeConfig, type UserConfigExport } from "vitest/config"
import shared from "../../vitest.shared.js"

const config: UserConfigExport = {
  test: {
    testTimeout: 60_000,
    hookTimeout: 90_000,
    sequence: {
      concurrent: false
    }
  }
}

export default mergeConfig(shared, config)
