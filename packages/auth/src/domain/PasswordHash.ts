import { Schema } from "effect"

export const PasswordHash = Schema.String.pipe(
  Schema.startsWith("$argon2id$", {
    identifier: "PasswordHash",
    message: () => "PasswordHash must be an argon2id hash"
  }),
  Schema.brand("PasswordHash")
)
export type PasswordHash = typeof PasswordHash.Type
