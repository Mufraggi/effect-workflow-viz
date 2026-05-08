import type { RunStatus } from "@template/domain/run/RunStatus"

const ALL_STATUSES: ReadonlyArray<RunStatus> = [
  "pending",
  "running",
  "success",
  "failed_app",
  "crashed",
  "interrupted",
  "unknown"
]

const isRunStatus = (s: unknown): s is RunStatus =>
  typeof s === "string" && (ALL_STATUSES as ReadonlyArray<string>).includes(s)

export interface RunsSearch {
  status?: ReadonlyArray<RunStatus> | undefined
  workflowName?: string | undefined
  traceId?: string | undefined
}

export const validateRunsSearch = (search: Record<string, unknown>): RunsSearch => {
  const raw = search["status"]
  const out: RunsSearch = {}
  if (Array.isArray(raw)) {
    const filtered = raw.filter(isRunStatus)
    if (filtered.length > 0) out.status = filtered
  } else if (isRunStatus(raw)) {
    out.status = [raw]
  }
  const wf = search["workflowName"]
  if (typeof wf === "string" && wf.length > 0) out.workflowName = wf
  const tr = search["traceId"]
  if (typeof tr === "string" && tr.length > 0) out.traceId = tr
  return out
}

export const STATUS_OPTIONS = ALL_STATUSES
