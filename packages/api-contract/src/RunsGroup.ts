import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Paginated } from "@template/domain/Pagination"
import { RunNotFound } from "@template/domain/run/errors"
import { MessageId } from "@template/domain/run/MessageId"
import { RunDetail } from "@template/domain/run/RunDetail"
import { RunStatus } from "@template/domain/run/RunStatus"
import { RunSummary } from "@template/domain/run/RunSummary"
import { TraceId } from "@template/domain/run/TraceId"
import { WorkflowName } from "@template/domain/workflow/WorkflowName"
import { Schema } from "effect"

const ListRunsParams = Schema.Struct({
  status: Schema.optional(Schema.Array(RunStatus)),
  workflowName: Schema.optional(WorkflowName),
  traceId: Schema.optional(TraceId),
  limit: Schema.optional(Schema.NumberFromString),
  before: Schema.optional(Schema.String)
})

const RunPathParams = Schema.Struct({
  messageId: MessageId
})

export class RunsGroup extends HttpApiGroup.make("runs")
  .add(
    HttpApiEndpoint.get("listRuns", "/runs")
      .setUrlParams(ListRunsParams)
      .addSuccess(Paginated(RunSummary))
  )
  .add(
    HttpApiEndpoint.get("getRun", "/runs/:messageId")
      .setPath(RunPathParams)
      .addSuccess(RunDetail)
      .addError(RunNotFound)
  )
  .add(
    HttpApiEndpoint.get("getChildRuns", "/runs/:messageId/children")
      .setPath(RunPathParams)
      .addSuccess(Schema.Array(RunSummary))
      .addError(RunNotFound)
  )
{}
