import { Schema } from "effect"
import { AuthUserId } from "./AuthUserId.js"
import { Email } from "./Email.js"
import { UserRole } from "./UserRole.js"

export class AuthUser extends Schema.Class<AuthUser>("AuthUser")({
  id: AuthUserId,
  email: Email,
  role: UserRole,
  createdAt: Schema.Date,
  lastLoginAt: Schema.NullOr(Schema.Date)
}) {}
