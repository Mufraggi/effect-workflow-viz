import { Schema } from "effect"

export const ShardId = Schema.String.pipe(Schema.brand("ShardId"))
export type ShardId = typeof ShardId.Type
