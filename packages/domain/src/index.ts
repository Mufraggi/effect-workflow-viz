export * as Pagination from "./Pagination.js"

export * as UserId from "./UserId.js"

export * as AuthErrors from "./auth/AuthErrors.js"

export * as AuthEvent from "./auth/AuthEvent.js"

/**
 * A normalized (lower-cased, trimmed) email address.
 *
 * Validation is intentionally lightweight — a single `@` with a dot in the
 * domain — since deliverability is enforced elsewhere, not by the schema.
 */
export * as Email from "./auth/Email.js"

export * as IpAddress from "./auth/IpAddress.js"

/**
 * Account role. The first account created through the setup flow is `admin`;
 * any account provisioned later defaults to `user`.
 */
export * as Role from "./auth/Role.js"

/**
 * The public representation of an account — everything the app may freely hold
 * in memory or expose. The password hash is deliberately absent: it never
 * leaves the `AuthRepository`.
 */
export * as User from "./auth/User.js"

export * as MessageId from "./run/MessageId.js"

export * as RunDetail from "./run/RunDetail.js"

export * as RunId from "./run/RunId.js"

export * as RunStatus from "./run/RunStatus.js"

export * as RunSummary from "./run/RunSummary.js"

export * as ShardId from "./run/ShardId.js"

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
export * as Snowflake from "./run/Snowflake.js"

export * as TraceId from "./run/TraceId.js"

export * as errors from "./run/errors.js"

export * as WorkflowName from "./workflow/WorkflowName.js"

export * as WorkflowReader from "./workflow/WorkflowReader.js"

/**
 * Walk a Cause tree (depth-first, left first) and return the first leaf node
 * matching the given tag. Returns the raw object so callers can read its data
 * (`error` for Fail, `defect` for Die, `fiberId` for Interrupt).
 */
export * as exit from "./workflow/decode/exit.js"

export * as status from "./workflow/decode/status.js"

/**
 * For a workflow run, the Cluster Exit's `value` field carries a WorkflowResult
 * shaped as `{ _tag: "Complete", exit: <inner Exit> }`. This returns the inner
 * Exit, or null if the input is not a workflow Complete result.
 */
export * as workflow from "./workflow/decode/workflow.js"
