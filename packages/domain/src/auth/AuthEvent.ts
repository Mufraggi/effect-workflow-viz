import { Schema } from "effect"

/** Event names recorded in the auth audit log. */
export const AuthEvent = Schema.Literal(
  "login_success",
  "login_failure",
  "login_blocked",
  "logout",
  "setup_completed",
  "account_created",
  "account_updated",
  "account_deleted"
)
export type AuthEvent = typeof AuthEvent.Type
