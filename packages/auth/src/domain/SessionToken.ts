import { Schema } from "effect"

export const SessionToken = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9]{32}$/, {
    identifier: "SessionToken",
    message: () => "SessionToken must be exactly 32 lowercase alphanumeric characters"
  }),
  Schema.brand("SessionToken")
)
export type SessionToken = typeof SessionToken.Type
