import { Schema } from "effect"
import { AuthUserId } from "./AuthUserId.js"
import { Email } from "./Email.js"

export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { email: Email }
) {}

export class EmailAlreadyTaken extends Schema.TaggedError<EmailAlreadyTaken>()(
  "EmailAlreadyTaken",
  { email: Email }
) {}

export class InvalidCredentials extends Schema.TaggedError<InvalidCredentials>()(
  "InvalidCredentials",
  {}
) {}

export class SessionExpired extends Schema.TaggedError<SessionExpired>()(
  "SessionExpired",
  {}
) {}

export class SessionNotFound extends Schema.TaggedError<SessionNotFound>()(
  "SessionNotFound",
  { userId: Schema.NullOr(AuthUserId) }
) {}

export class RateLimitExceeded extends Schema.TaggedError<RateLimitExceeded>()(
  "RateLimitExceeded",
  { retryAfterSeconds: Schema.Number }
) {}
