import { Effect } from "effect"
import * as crypto from "node:crypto"

const KEYLEN = 64
const SALTLEN = 16

const scrypt = (password: string, salt: Buffer): Effect.Effect<Buffer> =>
  Effect.async<Buffer>((resume) => {
    crypto.scrypt(password, salt, KEYLEN, (err, derivedKey) => {
      resume(err ? Effect.die(err) : Effect.succeed(derivedKey))
    })
  })

/**
 * Hash a plaintext password with scrypt (OWASP-recommended, zero native deps).
 * The returned string carries everything needed to verify it later:
 * `scrypt$<saltHex>$<hashHex>`.
 */
export const hashPassword = (plain: string): Effect.Effect<string> =>
  Effect.gen(function*() {
    const salt = crypto.randomBytes(SALTLEN)
    const derived = yield* scrypt(plain, salt)
    return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`
  })

/**
 * Verify a plaintext password against a stored `scrypt$salt$hash` string using
 * a constant-time comparison. Returns `false` for any malformed input.
 */
export const verifyPassword = (plain: string, stored: string): Effect.Effect<boolean> =>
  Effect.gen(function*() {
    const parts = stored.split("$")
    if (parts.length !== 3 || parts[0] !== "scrypt") return false
    const salt = Buffer.from(parts[1]!, "hex")
    const expected = Buffer.from(parts[2]!, "hex")
    const derived = yield* scrypt(plain, salt)
    if (derived.length !== expected.length) return false
    return crypto.timingSafeEqual(derived, expected)
  })
