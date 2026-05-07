import { Schema } from "effect"

export class PageRequest extends Schema.Class<PageRequest>("PageRequest")({
  limit: Schema.Number.pipe(Schema.int(), Schema.between(1, 200)),
  before: Schema.NullOr(Schema.String)
}) {}

export const Paginated = <A, I, R>(item: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    items: Schema.Array(item),
    nextCursor: Schema.NullOr(Schema.String)
  })
