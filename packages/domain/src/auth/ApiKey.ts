import { Schema } from "effect"

/**
 * An API key for programmatic access (e.g. MCP).
 *
 * The `keyPrefix` is the first 8 chars of the raw key, stored so the UI can
 * display a recognisable label without ever showing the full key again.
 *
 * The `keyHash` carries the Argon2id hash of the raw key.
 */
export class ApiKey extends Schema.Class<ApiKey>("ApiKey")({
  id: Schema.String,
  userId: Schema.String,
  name: Schema.String,
  keyPrefix: Schema.String,
  createdAt: Schema.DateFromString,
  lastUsedAt: Schema.NullOr(Schema.DateFromString),
  expiresAt: Schema.NullOr(Schema.DateFromString),
  isRevoked: Schema.Boolean
}) {}

/** Payload returned when a new key is created — includes the raw key once. */
export class ApiKeyCreated extends Schema.Class<ApiKeyCreated>("ApiKeyCreated")({
  id: Schema.String,
  name: Schema.String,
  keyPrefix: Schema.String,
  rawKey: Schema.String,
  createdAt: Schema.DateFromString,
  expiresAt: Schema.NullOr(Schema.DateFromString)
}) {}
