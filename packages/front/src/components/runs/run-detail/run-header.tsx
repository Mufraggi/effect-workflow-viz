import { StatusBadge } from "@/components/runs/status-badge"
import type { RunDetail } from "@template/domain/run/RunDetail"

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "UTC"
})

export const RunHeader = ({ run }: { run: RunDetail }) => (
  <header className="space-y-3 border-b border-border pb-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h1 className="font-serif text-2xl font-semibold leading-tight">{run.workflowName}</h1>
        <div className="font-mono text-xs text-muted-foreground break-all">{run.runId}</div>
      </div>
      <StatusBadge status={run.status} />
    </div>
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
      <dt className="text-muted-foreground">Message ID</dt>
      <dd className="font-mono break-all">{String(run.id)}</dd>
      <dt className="text-muted-foreground">Trace ID</dt>
      <dd className="font-mono break-all">{run.traceId ? String(run.traceId) : "—"}</dd>
      <dt className="text-muted-foreground">Shard</dt>
      <dd className="font-mono">{String(run.shardId)}</dd>
      <dt className="text-muted-foreground">Started (UTC)</dt>
      <dd className="font-mono tabular-nums">
        {run.startedAtProxy ? dateFmt.format(run.startedAtProxy) : "—"}
      </dd>
    </dl>
  </header>
)
