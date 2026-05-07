import { Schema } from "effect"

export const TraceId = Schema.String.pipe(Schema.brand("TraceId"))
export type TraceId = typeof TraceId.Type
