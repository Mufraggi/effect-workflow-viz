import { Schema } from "effect"

export const SessionId = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9]{16}$/, {
    identifier: "SessionId",
    message: () => "SessionId must be exactly 16 lowercase alphanumeric characters"
  }),
  Schema.brand("SessionId")
)
export type SessionId = typeof SessionId.Type
