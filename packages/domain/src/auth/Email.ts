import { Schema } from "effect"

/**
 * A normalized (lower-cased, trimmed) email address.
 *
 * Validation is intentionally lightweight — a single `@` with a dot in the
 * domain — since deliverability is enforced elsewhere, not by the schema.
 */
export const Email = Schema.String.pipe(
  Schema.trimmed(),
  Schema.lowercased(),
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: () => "Must be a valid email address"
  }),
  Schema.brand("Email")
)

export type Email = typeof Email.Type
