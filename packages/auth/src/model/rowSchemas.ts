import { Schema } from "effect"
import { AuthUserId } from "../domain/AuthUserId.js"
import { Email } from "../domain/Email.js"
import { IpAddress } from "../domain/IpAddress.js"
import { PasswordHash } from "../domain/PasswordHash.js"
import { SessionId } from "../domain/SessionId.js"
import { TokenHash } from "../domain/TokenHash.js"
import { UserRole } from "../domain/UserRole.js"

export const UserRow = Schema.Struct({
  id: AuthUserId,
  email: Email,
  passwordHash: PasswordHash,
  role: UserRole,
  createdAt: Schema.Number,
  lastLoginAt: Schema.NullOr(Schema.Number)
})
export type UserRow = typeof UserRow.Type

export const SessionRow = Schema.Struct({
  id: SessionId,
  tokenHash: TokenHash,
  userId: AuthUserId,
  createdAt: Schema.Number,
  expiresAt: Schema.Number,
  lastUsedAt: Schema.Number,
  userAgent: Schema.NullOr(Schema.String),
  ipAddress: Schema.NullOr(IpAddress)
})
export type SessionRow = typeof SessionRow.Type

export const LoginAttemptRow = Schema.Struct({
  ipAddress: IpAddress,
  attemptedAt: Schema.Number,
  succeeded: Schema.Number
})
export type LoginAttemptRow = typeof LoginAttemptRow.Type
