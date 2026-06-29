#!/usr/bin/env tsx
/**
 * CLI tool to create a guest account.
 *
 * Usage:
 *   pnpm tsx scripts/create-guest-account.ts \
 *     --email guest@example.com --password secret123 [--role guest]
 *
 * The role defaults to "guest". This script uses the same Effect runtime and
 * SQLite database as the web server (AUTH_DB_PATH env var, default ./data/auth.db).
 *
 * It provides a convenient way to provision guest accounts for testing
 * without going through the web UI (which is admin-only).
 */

import { AuthRepository } from "@template/auth/AuthRepository"
import { hashPassword } from "@template/auth/password"
import { Email } from "@template/domain/auth/Email"
import { Role } from "@template/domain/auth/Role"
import { Option } from "effect"
import { Effect, ManagedRuntime } from "effect"

// Parse CLI arguments
const args = process.argv.slice(2)
const getArg = (flag: string): string | undefined => {
  const idx = args.indexOf(flag)
  return idx !== -1 && args.length > idx + 1 ? args[idx + 1] : undefined
}

const emailRaw = getArg("--email")
const passwordRaw = getArg("--password")
const roleRaw = getArg("--role") ?? "guest"

if (!emailRaw || !passwordRaw) {
  console.error("Usage: tsx scripts/create-guest-account.ts --email <email> --password <password> [--role <role>]")
  process.exit(1)
}

// Validate email
const parsedEmail = Email.make(emailRaw)
if (Option.isNone(parsedEmail)) {
  console.error(`Invalid email: ${emailRaw}`)
  process.exit(1)
}

// Validate role
const allowedRoles = Role.literals as ReadonlyArray<string>
if (!allowedRoles.includes(roleRaw)) {
  console.error(`Invalid role "${roleRaw}". Must be one of: ${allowedRoles.join(", ")}`)
  process.exit(1)
}

const role = roleRaw as import("@template/domain/auth/Role").Role

const AppLayer = AuthRepository.Default

const runtime = ManagedRuntime.make(AppLayer)

const program = Effect.gen(function*() {
  const repo = yield* AuthRepository
  const passwordHash = yield* hashPassword(passwordRaw)
  const user = yield* repo.createUser({ email: parsedEmail.value, passwordHash, role })
  console.log(`Account created: ${user.email} (${user.role})`)
  return user
})

await runtime.runPromise(program).catch((err) => {
  console.error("Failed to create account:", (err as Error)?.message ?? String(err))
  process.exit(1)
})

runtime.dispose()
