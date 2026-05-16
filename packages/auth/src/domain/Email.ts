import { Schema } from "effect"

export const Email = Schema.String.pipe(
  Schema.trimmed({
    identifier: "Email",
    message: () => "Email must not have leading or trailing whitespace"
  }),
  Schema.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
    identifier: "Email",
    message: () => "Invalid email address format"
  }),
  Schema.maxLength(254, {
    identifier: "Email",
    message: () => "Email must not exceed 254 characters"
  }),
  Schema.brand("Email")
)
export type Email = typeof Email.Type
