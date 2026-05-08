import { type RunsSearch, STATUS_OPTIONS } from "@/lib/runs-search"
import { cn } from "@/lib/utils"
import type { RunStatus } from "@template/domain/run/RunStatus"
import { useEffect, useState } from "react"

interface Props {
  value: RunsSearch
  onChange: (next: RunsSearch) => void
}

export const RunsFilters = ({ onChange, value }: Props) => {
  const [workflow, setWorkflow] = useState(value.workflowName ?? "")
  const [trace, setTrace] = useState(value.traceId ?? "")

  useEffect(() => {
    setWorkflow(value.workflowName ?? "")
    setTrace(value.traceId ?? "")
  }, [value.workflowName, value.traceId])

  const toggleStatus = (s: RunStatus) => {
    const current = value.status ?? []
    const next = current.includes(s) ? current.filter((x) => x !== s) : [...current, s]
    onChange({ ...value, status: next.length > 0 ? next : undefined })
  }

  const commit = (patch: Partial<RunsSearch>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-3 border-b border-border pb-3">
      <div className="flex flex-wrap gap-1.5">
        {STATUS_OPTIONS.map((s) => {
          const active = value.status?.includes(s) ?? false
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide transition",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:border-foreground/30"
              )}
            >
              {s}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={workflow}
          onChange={(e) => setWorkflow(e.target.value)}
          onBlur={() => commit({ workflowName: workflow.trim() || undefined })}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit({ workflowName: workflow.trim() || undefined })
          }}
          placeholder="Workflow name (prefix)"
          className="flex-1 min-w-[140px] rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-foreground/40"
        />
        <input
          type="text"
          value={trace}
          onChange={(e) => setTrace(e.target.value)}
          onBlur={() => commit({ traceId: trace.trim() || undefined })}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit({ traceId: trace.trim() || undefined })
          }}
          placeholder="Trace ID"
          className="flex-1 min-w-[140px] rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-foreground/40 font-mono text-xs"
        />
        {(value.status || value.workflowName || value.traceId) && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
