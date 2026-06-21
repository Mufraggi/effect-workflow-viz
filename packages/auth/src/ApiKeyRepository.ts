import { SqlClient, SqlSchema } from "@effect/sql"
import { ApiKey, ApiKeyCreated } from "@template/domain/auth/ApiKey"
import { ApiKeyNotFound, ApiKeyRevoked } from "@template/domain/auth/ApiKeyErrors"
import { Effect, Schema } from "effect"
import * as crypto from "node:crypto"
import { Argon2id } from "oslo/password"
import { SqliteLive } from "./SqliteLive.js"

const argon2 = new Argon2id()

/** Generate a cryptographically random API key. Returns `sk_<64-hex-chars>`. */
function generateRawKey(): string {
  return "sk_" + crypto.randomBytes(32).toString("hex")
}

/** Hash a raw API key with Argon2id. */
function hashKey(raw: string): Effect.Effect<string> {
  return Effect.tryPromise(() => argon2.hash(raw)).pipe(Effect.orDie)
}

/** Verify a raw key against a stored hash. */
function verifyKey(raw: string, stored: string): Effect.Effect<boolean> {
  return Effect.tryPromise(() => argon2.verify(stored, raw)).pipe(
    Effect.catchAll(() => Effect.succeed(false))
  )
}

/**
 * Manage API keys for programmatic access (MCP).
 *
 * Keys are stored hashed (Argon2id). The raw key is revealed once at creation,
 * matching the password pattern in `AuthRepository`.
 */
export class ApiKeyRepository extends Effect.Service<ApiKeyRepository>()("ApiKeyRepository", {
  effect: Effect.gen(function*() {
    const sql = yield* SqlClient.SqlClient

    yield* sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        expires_at TEXT,
        is_revoked INTEGER NOT NULL DEFAULT 0
      )
    `

    /** API key row as returned by SQLite (snake_case keys) */
    const KeyRow = Schema.Struct({
      id: Schema.String,
      userId: Schema.String,
      name: Schema.String,
      keyPrefix: Schema.String,
      createdAt: Schema.String,
      lastUsedAt: Schema.NullOr(Schema.String),
      expiresAt: Schema.NullOr(Schema.String),
      isRevoked: Schema.Number
    })

    /**
     * List all non-revoked keys for a user.
     */
    const listForUserSchema = SqlSchema.findAll({
      Request: Schema.String,
      Result: KeyRow,
      execute: (userId) =>
        sql`SELECT id, user_id, name, key_prefix, created_at, last_used_at, expires_at, is_revoked
            FROM api_keys WHERE user_id = ${userId} AND is_revoked = 0
            ORDER BY created_at DESC`
    })
    const listForUser = (userId: string): Effect.Effect<ReadonlyArray<ApiKey>> =>
      listForUserSchema(userId).pipe(
        Effect.map((rows) =>
          rows.map((r) =>
            new ApiKey({
              ...r,
              createdAt: new Date(r.createdAt),
              lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt) : null,
              expiresAt: r.expiresAt ? new Date(r.expiresAt) : null,
              isRevoked: r.isRevoked === 1
            })
          )
        ),
        Effect.orDie,
        Effect.withSpan("ApiKeyRepository.listForUser")
      )

    /**
     * Create a new API key for a user.
     */
    const create = (input: {
      readonly userId: string
      readonly name: string
      readonly expiresAt?: Date | null
    }): Effect.Effect<ApiKeyCreated> =>
      Effect.gen(function*() {
        const rawKey = generateRawKey()
        const keyHash = yield* hashKey(rawKey)
        const id = crypto.randomUUID()
        const keyPrefix = rawKey.slice(0, 8)
        const createdAt = new Date()

        yield* sql`
          INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, created_at, expires_at, is_revoked)
          VALUES (${id}, ${input.userId}, ${input.name}, ${keyPrefix}, ${keyHash}, ${createdAt.toISOString()}, ${
          input.expiresAt?.toISOString() ?? null
        }, 0)
        `

        return new ApiKeyCreated({
          id,
          name: input.name,
          keyPrefix,
          rawKey,
          createdAt,
          expiresAt: input.expiresAt ?? null
        })
      }).pipe(Effect.orDie, Effect.withSpan("ApiKeyRepository.create"))

    /**
     * Revoke a key by id.
     */
    const revoke = (id: string): Effect.Effect<void, ApiKeyNotFound> =>
      Effect.gen(function*() {
        const found: ReadonlyArray<any> = yield* sql`SELECT 1 AS present FROM api_keys WHERE id = ${id} LIMIT 1`
        if (found.length === 0) {
          return yield* Effect.fail(new ApiKeyNotFound({ id }))
        }
        yield* sql`UPDATE api_keys SET is_revoked = 1 WHERE id = ${id}`
      }).pipe(
        Effect.catchTag("SqlError", (err) => Effect.die(err)),
        Effect.withSpan("ApiKeyRepository.revoke")
      )

    /**
     * Validate a raw API key (`Authorization: Bearer sk_...`).
     *
     * Scans all active (non-revoked) keys and attempts to match the raw key
     * against each stored hash. This is O(n) where n is the number of active
     * keys (typically <100), so it's acceptable.
     */
    const validate = (rawKey: string): Effect.Effect<ApiKey, ApiKeyNotFound | ApiKeyRevoked> =>
      Effect.gen(function*() {
        const rows = (yield* sql`SELECT * FROM api_keys WHERE is_revoked = 0`) as unknown as ReadonlyArray<
          typeof KeyRow.Type & { readonly keyHash: string }
        >

        for (const row of rows) {
          const match = yield* verifyKey(rawKey, row.keyHash)
          if (!match) continue

          if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
            return yield* Effect.fail(new ApiKeyRevoked({}))
          }

          yield* sql`UPDATE api_keys SET last_used_at = ${new Date().toISOString()} WHERE id = ${row.id}`.pipe(
            Effect.ignore
          )

          return new ApiKey({
            id: row.id,
            userId: row.userId,
            name: row.name,
            keyPrefix: row.keyPrefix,
            createdAt: new Date(row.createdAt),
            lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : null,
            expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
            isRevoked: row.isRevoked === 1
          })
        }

        return yield* Effect.fail(new ApiKeyNotFound({ id: rawKey.slice(0, 8) + "..." }))
      }).pipe(
        Effect.catchTag("SqlError", (err) => Effect.die(err)),
        Effect.withSpan("ApiKeyRepository.validate")
      )

    return { listForUser, create, revoke, validate } as const
  }),
  dependencies: [SqliteLive]
}) {}
