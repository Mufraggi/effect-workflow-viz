import { Schema } from "effect"

/**
 * The requester does not have permission to perform the given action on the
 * given entity.
 *
 * Returned as HTTP 403 Forbidden — distinct from InvalidCredentials (401
 * Unauthorized), so the caller can distinguish "not authenticated" from
 * "authenticated but not allowed".
 */
export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", {
  reason: Schema.String,
  entity: Schema.String,
  action: Schema.String
}) {}
