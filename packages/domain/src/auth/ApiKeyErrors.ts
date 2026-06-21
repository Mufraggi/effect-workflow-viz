import { Schema } from "effect"

/** No matching key found for the given key id. */
export class ApiKeyNotFound extends Schema.TaggedError<ApiKeyNotFound>()(
  "ApiKeyNotFound",
  { id: Schema.String }
) {}

/** The key exists but has been revoked. */
export class ApiKeyRevoked extends Schema.TaggedError<ApiKeyRevoked>()(
  "ApiKeyRevoked",
  {}
) {}

/** The key exists but has expired. */
export class ApiKeyExpired extends Schema.TaggedError<ApiKeyExpired>()(
  "ApiKeyExpired",
  {}
) {}
