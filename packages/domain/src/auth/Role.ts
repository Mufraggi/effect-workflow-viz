import { Schema } from "effect"

/**
 * Account role. The first account created through the setup flow is `admin`;
 * any account provisioned later defaults to `user`.
 */
export const Role = Schema.Literal("admin", "user")

export type Role = typeof Role.Type
