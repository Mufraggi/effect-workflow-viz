import { Schema } from "effect"

export const AuthUserId = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9]{16}$/, {
    identifier: "AuthUserId",
    message: () => "AuthUserId must be exactly 16 lowercase alphanumeric characters"
  }),
  Schema.brand("AuthUserId")
)
export type AuthUserId = typeof AuthUserId.Type
