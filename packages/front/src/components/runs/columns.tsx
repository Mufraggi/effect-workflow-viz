import type { ColumnDef } from "@tanstack/react-table"
import type { RunSummary } from "@template/domain/run/RunSummary"
import { StatusBadge } from "./status-badge.js"

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "UTC"
})

const truncate = (s: string, n: number) => (s.length <= n + 3 ? s : `${s.slice(0, n)}…`)

export const runColumns: Array<ColumnDef<RunSummary>> = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />
  },
  {
    accessorKey: "workflowName",
    header: "Workflow",
    cell: ({ row }) => <span className="font-medium">{row.original.workflowName}</span>
  },
  {
    accessorKey: "runId",
    header: "Run ID",
    cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.runId}</span>
  },
  {
    accessorKey: "startedAtProxy",
    header: "Started (UTC)",
    cell: ({ row }) => {
      const d = row.original.startedAtProxy
      return <span className="font-mono tabular-nums text-xs">{d ? dateFmt.format(d) : "—"}</span>
    }
  },
  {
    accessorKey: "traceId",
    header: "Trace",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.traceId ? truncate(String(row.original.traceId), 8) : "—"}
      </span>
    )
  },
  {
    accessorKey: "id",
    header: "Message ID",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {truncate(String(row.original.id), 10)}
      </span>
    )
  }
]
