import { Schema } from "effect"

export const MessageId = Schema.String.pipe(Schema.brand("MessageId"))
export type MessageId = typeof MessageId.Type
