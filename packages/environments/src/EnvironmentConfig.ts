import { Schema } from "effect"

/**
 * Represents a single environment connection config (e.g. "Production", "Pre-prod").
 * Stored in the same writable SQLite DB that backs auth so it can be managed from
 * the UI without a separate migration runner.
 *
 * Passwords are stored in plain text — this is a deliberate UX trade-off for a
 * local/self-hosted admin tool.
 *
 * @see https://github.com/Effect-TS/effect
 */
export class EnvironmentConfig extends Schema.Class<EnvironmentConfig>("EnvironmentConfig")({
  id: Schema.String,
  name: Schema.String,
  host: Schema.String,
  port: Schema.String,
  user: Schema.String,
  password: Schema.String,
  dbName: Schema.String,
  ssl: Schema.Boolean,
  isDefault: Schema.Boolean,
  createdAt: Schema.DateFromString
}) {}
