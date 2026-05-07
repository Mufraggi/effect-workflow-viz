import { MessageId } from "@template/domain/run/MessageId"
import { RunDetail } from "@template/domain/run/RunDetail"
import { RunId } from "@template/domain/run/RunId"
import { ShardId } from "@template/domain/run/ShardId"
import { TraceId } from "@template/domain/run/TraceId"
import { WorkflowName } from "@template/domain/workflow/WorkflowName"

export const TRACE_PARENT = TraceId.make("abc123abc123abc123abc123abc12300")
export const TRACE_OTHER = TraceId.make("ffffffffffffffffffffffffffffffff")

export const PARENT_ID = MessageId.make("100000000000000001")
export const CHILD_A_ID = MessageId.make("100000000000000002")
export const CHILD_B_ID = MessageId.make("100000000000000003")
export const FAILED_ID = MessageId.make("100000000000000004")

const makeDetail = (params: {
  id: MessageId
  workflowName: string
  runId: string
  shardId?: string
  traceId: TraceId | null
  status: RunDetail["status"]
}): RunDetail =>
  new RunDetail({
    id: params.id,
    workflowName: WorkflowName.make(params.workflowName),
    runId: RunId.make(params.runId),
    shardId: ShardId.make(params.shardId ?? "default:1"),
    traceId: params.traceId,
    startedAtProxy: null,
    status: params.status,
    input: null,
    output: null,
    children: []
  })

export const seed: ReadonlyArray<RunDetail> = [
  makeDetail({
    id: PARENT_ID,
    workflowName: "OrderFlow",
    runId: "order-1",
    traceId: TRACE_PARENT,
    status: "success"
  }),
  makeDetail({
    id: CHILD_A_ID,
    workflowName: "PaymentSubFlow",
    runId: "payment-a",
    traceId: TRACE_PARENT,
    status: "success"
  }),
  makeDetail({
    id: CHILD_B_ID,
    workflowName: "EmailSubFlow",
    runId: "email-b",
    traceId: TRACE_PARENT,
    status: "failed_app"
  }),
  makeDetail({
    id: FAILED_ID,
    workflowName: "OrderFlow",
    runId: "order-2",
    traceId: TRACE_OTHER,
    status: "failed_app"
  })
]
