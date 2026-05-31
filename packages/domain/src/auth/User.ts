import { Schema } from "effect"
import { UserId } from "../UserId.js"
import { Email } from "./Email.js"
import { Role } from "./Role.js"

/**
 * The public representation of an account — everything the app may freely hold
 * in memory or expose. The password hash is deliberately absent: it never
 * leaves the `AuthRepository`.
 */
export class User extends Schema.Class<User>("User")({
  id: UserId,
  email: Email,
  role: Role,
  createdAt: Schema.DateFromString
}) {}
