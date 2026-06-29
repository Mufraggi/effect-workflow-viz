import { Schema } from "effect"

/**
 * Account role. The first account created through the setup flow is `admin`;
 * any account provisioned later defaults to `user`. `readonly` and `guest`
 * are lower-privilege roles for restricted access.
 */
export const Role = Schema.Literal("admin", "user", "readonly", "guest")

export type Role = typeof Role.Type
