/**
 * Effect Cluster message IDs (the `cluster_messages.id` / `last_reply_id`
 * columns) are Snowflakes: a 64-bit integer that packs the creation timestamp
 * into its high bits. Layout (see `@effect/cluster` `Snowflake`):
 *
 *   bits 22..63  millisecond timestamp, offset by `SNOWFLAKE_EPOCH`
 *   bits 12..21  machine id
 *   bits  0..11  per-millisecond sequence
 *
 * So a run's wall-clock creation time is recoverable from its id alone — which
 * is what lets us derive a real `startedAt` (from the message id) and an
 * approximate duration (reply id timestamp − message id timestamp) without any
 * extra timing column.
 */
export const SNOWFLAKE_EPOCH = Date.UTC(2025, 0, 1)

/** Milliseconds since the Unix epoch encoded in a Snowflake id. */
export const snowflakeToMillis = (id: bigint): number => Number(id >> 22n) + SNOWFLAKE_EPOCH

/** The `Date` encoded in a Snowflake id. */
export const snowflakeToDate = (id: bigint): Date => new Date(snowflakeToMillis(id))

/**
 * The smallest Snowflake whose timestamp is `ms` (low bits zeroed). Used to
 * turn a date-range filter into `id`-column bounds, reusing the existing
 * id-ordered index/cursor instead of a separate timestamp column.
 */
export const millisToSnowflake = (ms: number): bigint => BigInt(Math.trunc(ms) - SNOWFLAKE_EPOCH) << 22n
