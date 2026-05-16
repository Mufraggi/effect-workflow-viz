import { Schema } from "effect"

export const UserRole = Schema.Literal("admin", "user", "readonly")
export type UserRole = typeof UserRole.Type
