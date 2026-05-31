import { Schema } from "effect"

/** Login failed: no such email, or the password did not match. */
export class InvalidCredentials extends Schema.TaggedError<InvalidCredentials>()(
  "InvalidCredentials",
  {}
) {}

/** Attempted to create an account whose email already exists. */
export class UserAlreadyExists extends Schema.TaggedError<UserAlreadyExists>()(
  "UserAlreadyExists",
  { email: Schema.String }
) {}

/** Looked up an account that does not exist. */
export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { id: Schema.String }
) {}

/** The first-run admin setup flow was attempted after an account already exists. */
export class SetupAlreadyComplete extends Schema.TaggedError<SetupAlreadyComplete>()(
  "SetupAlreadyComplete",
  {}
) {}

/** Too many failed login attempts from an IP within the rate-limit window. */
export class RateLimitExceeded extends Schema.TaggedError<RateLimitExceeded>()(
  "RateLimitExceeded",
  { retryAfterSeconds: Schema.Number }
) {}
