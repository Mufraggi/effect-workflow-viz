import { Schema } from "effect"

const Timestamp = Schema.NullOr(Schema.String)

export const RunListingRow = Schema.Struct({
  id: Schema.String,
  entityType: Schema.String,
  entityId: Schema.String,
  shardId: Schema.String,
  traceId: Schema.NullOr(Schema.String),
  processed: Schema.Boolean,
  lastRead: Timestamp,
  // The completing reply's Snowflake id — its timestamp marks the run's end,
  // used to derive duration. Null while the run has no reply yet.
  lastReplyId: Schema.NullOr(Schema.String),
  replyKind: Schema.NullOr(Schema.Number),
  replyPayload: Schema.NullOr(Schema.String)
})

export type RunListingRow = typeof RunListingRow.Type

export const RunDetailRow = Schema.Struct({
  ...RunListingRow.fields,
  messagePayload: Schema.NullOr(Schema.String),
  headers: Schema.NullOr(Schema.String)
})

export type RunDetailRow = typeof RunDetailRow.Type
