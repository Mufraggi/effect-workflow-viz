import { Schema } from "effect"

export const TokenHash = Schema.String.pipe(
  Schema.pattern(/^[a-f0-9]{64}$/, {
    identifier: "TokenHash",
    message: () => "TokenHash must be a 64-character lowercase hex string (SHA-256)"
  }),
  Schema.brand("TokenHash")
)
export type TokenHash = typeof TokenHash.Type
