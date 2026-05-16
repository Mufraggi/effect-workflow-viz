import { Schema } from "effect"
import { AuthUserId } from "./AuthUserId.js"
import { IpAddress } from "./IpAddress.js"
import { SessionId } from "./SessionId.js"

export class Session extends Schema.Class<Session>("Session")({
  id: SessionId,
  userId: AuthUserId,
  expiresAt: Schema.Date,
  lastUsedAt: Schema.Date,
  userAgent: Schema.NullOr(Schema.String),
  ipAddress: Schema.NullOr(IpAddress)
}) {}
