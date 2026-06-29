import { Schema } from "effect"
import { Role } from "./Role.js"

/**
 * Branded string for policy-role comparisons. Runtime value is the same string
 * as the DB role column, but the branded type prevents accidental mixing with
 * raw strings outside of the policy system.
 */
export const RoleName = Schema.String.pipe(Schema.brand("RoleName"))
export type RoleName = typeof RoleName.Type

/**
 * Pre-defined role-name constants. Used by the policy matrix and nowhere else.
 * Keep in sync with the `Role` literal.
 */
export const roleNames = {
  admin:    RoleName.make("admin"),
  user:     RoleName.make("user"),
  readonly: RoleName.make("readonly"),
  guest:    RoleName.make("guest")
} as const

/**
 * Lift a domain `Role` (the raw union string from the DB/Schema) to a
 * `RoleName` for policy checks.
 */
export const toRoleName = (role: Role): RoleName => RoleName.make(role)
