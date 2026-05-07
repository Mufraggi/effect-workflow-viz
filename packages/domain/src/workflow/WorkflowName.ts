import { Schema } from "effect"

export const WorkflowName = Schema.String.pipe(Schema.brand("WorkflowName"))
export type WorkflowName = typeof WorkflowName.Type
