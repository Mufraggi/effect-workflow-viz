import type { RunStatus } from "../../run/RunStatus.js"
import { decodeCauseRoot, decodeExitTag } from "./exit.js"
import { unwrapWorkflowResult } from "./workflow.js"

const RUNNING_THRESHOLD_MS = 10 * 60 * 1000

const isObject = (u: unknown): u is Record<string, unknown> => typeof u === "object" && u !== null

export interface DecodeRunStatusInput {
  readonly processed: boolean
  readonly lastRead: Date | null
  readonly replyKind: number | null
  readonly replyPayload: string | null
  readonly isWorkflow: boolean
  readonly now: Date
}

export const decodeRunStatus = (row: DecodeRunStatusInput): RunStatus => {
  if (row.replyKind === null || row.replyPayload === null) {
    if (row.lastRead === null) return "pending"
    const ageMs = row.now.getTime() - row.lastRead.getTime()
    return ageMs < RUNNING_THRESHOLD_MS ? "running" : "pending"
  }

  if (row.replyKind !== 0) return "unknown"

  let parsed: unknown
  try {
    parsed = JSON.parse(row.replyPayload)
  } catch {
    return "unknown"
  }

  const outerTag = decodeExitTag(parsed)
  if (outerTag === null) return "unknown"

  if (outerTag === "Failure") {
    if (!isObject(parsed)) return "unknown"
    return causeRootToStatus(decodeCauseRoot(parsed["cause"]))
  }

  if (!row.isWorkflow) return "success"

  if (!isObject(parsed)) return "unknown"
  const inner = unwrapWorkflowResult(parsed["value"])
  if (inner === null) return "unknown"

  const innerTag = decodeExitTag(inner)
  if (innerTag === "Success") return "success"
  if (innerTag === "Failure") {
    if (!isObject(inner)) return "unknown"
    return causeRootToStatus(decodeCauseRoot(inner["cause"]))
  }
  return "unknown"
}

const causeRootToStatus = (root: ReturnType<typeof decodeCauseRoot>): RunStatus => {
  switch (root) {
    case "Fail":
      return "failed_app"
    case "Die":
      return "crashed"
    case "Interrupt":
      return "interrupted"
    default:
      return "unknown"
  }
}
