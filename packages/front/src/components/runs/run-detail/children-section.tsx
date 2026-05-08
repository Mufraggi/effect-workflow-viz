import { cn } from "@/lib/utils"
import { Link } from "@tanstack/react-router"
import type { RunDetail } from "@template/domain/run/RunDetail"
import type { RunStatus } from "@template/domain/run/RunStatus"
import type { RunSummary } from "@template/domain/run/RunSummary"
import { useMemo } from "react"
import { ChildrenTimeline, formatDelta, type TimelinePoint } from "./children-timeline.js"

const truncate = (s: string, n: number) => (s.length <= n + 3 ? s : `${s.slice(0, n)}…`)

const STATUS_DOT: Record<RunStatus, string> = {
  success: "bg-emerald-500",
  running: "bg-blue-500",
  pending: "bg-zinc-400",
  failed_app: "bg-red-500",
  crashed: "bg-red-700",
  interrupted: "bg-orange-500",
  unknown: "bg-zinc-400"
}

const STATUS_TEXT: Record<RunStatus, string> = {
  success: "text-emerald-700 dark:text-emerald-400",
  running: "text-blue-700 dark:text-blue-400",
  pending: "text-zinc-600 dark:text-zinc-300",
  failed_app: "text-red-700 dark:text-red-400",
  crashed: "text-red-800 dark:text-red-300",
  interrupted: "text-orange-700 dark:text-orange-400",
  unknown: "text-muted-foreground"
}

export const ChildrenSection = ({ run }: { run: RunDetail }) => {
  const allRuns = useMemo<ReadonlyArray<RunSummary>>(() => {
    const parentSummary: RunSummary = {
      id: run.id,
      workflowName: run.workflowName,
      runId: run.runId,
      shardId: run.shardId,
      traceId: run.traceId,
      startedAtProxy: run.startedAtProxy,
      status: run.status
    } as RunSummary
    return [parentSummary, ...run.children]
  }, [run])

  const parentTime = run.startedAtProxy?.getTime() ?? null

  const sortedChildren = useMemo(() => {
    return [...run.children].sort((a, b) => {
      const at = a.startedAtProxy?.getTime() ?? Number.POSITIVE_INFINITY
      const bt = b.startedAtProxy?.getTime() ?? Number.POSITIVE_INFINITY
      return at - bt
    })
  }, [run.children])

  const timelinePoints = useMemo<ReadonlyArray<TimelinePoint>>(
    () =>
      allRuns
        .filter((r): r is RunSummary & { startedAtProxy: Date } => r.startedAtProxy !== null)
        .map((r) => ({
          t: r.startedAtProxy.getTime(),
          status: r.status,
          isParent: r.id === run.id
        })),
    [allRuns, run.id]
  )

  const aggregate = useMemo(() => buildAggregate(allRuns), [allRuns])

  return (
    <section className="space-y-3">
      <div className="text-xs text-muted-foreground">{aggregate}</div>
      {timelinePoints.length > 1 && <ChildrenTimeline points={timelinePoints} />}
      {run.children.length === 0
        ? <p className="text-sm text-muted-foreground">No child runs.</p>
        : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="text-left text-muted-foreground">
                  <th className="w-6 px-2 py-1.5"></th>
                  <th className="px-2 py-1.5 font-medium">Workflow</th>
                  <th className="px-2 py-1.5 font-medium">Run ID</th>
                  <th className="px-2 py-1.5 font-medium text-right">Δ</th>
                  <th className="px-2 py-1.5 font-medium">Shard</th>
                </tr>
              </thead>
              <tbody>
                {sortedChildren.map((child) => (
                  <ChildRow
                    key={String(child.id)}
                    child={child}
                    parentTime={parentTime}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  )
}

const ChildRow = ({
  child,
  parentTime
}: {
  child: RunSummary
  parentTime: number | null
}) => {
  const childTime = child.startedAtProxy?.getTime() ?? null
  const delta = parentTime !== null && childTime !== null ? childTime - parentTime : null

  return (
    <tr className="border-t border-border/60 hover:bg-secondary/40">
      <td className="px-2 py-1.5">
        <span
          className={cn("inline-block h-2 w-2 rounded-full", STATUS_DOT[child.status])}
          title={child.status}
        />
      </td>
      <td className="px-2 py-1.5 font-mono">{child.workflowName}</td>
      <td className="px-2 py-1.5 font-mono">
        <Link
          to="/runs/$messageId"
          params={{ messageId: String(child.id) }}
          className="text-foreground hover:underline"
        >
          {truncate(String(child.runId), 12)}
        </Link>
      </td>
      <td className="px-2 py-1.5 text-right font-mono tabular-nums">
        {delta === null ? "—" : delta >= 0 ? `+${formatDelta(delta)}` : `−${formatDelta(-delta)}`}
      </td>
      <td className="px-2 py-1.5 font-mono text-muted-foreground">{String(child.shardId)}</td>
    </tr>
  )
}

const buildAggregate = (runs: ReadonlyArray<RunSummary>): React.ReactNode => {
  const total = runs.length
  const counts = new Map<RunStatus, number>()
  for (const r of runs) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)
  if (counts.size === 1) {
    const only = runs[0].status
    return (
      <>
        {`${total} related run${total > 1 ? "s" : ""}, all `}
        <span className={STATUS_TEXT[only]}>{only}</span>
      </>
    )
  }
  const parts = Array.from(counts.entries()).map(([status, n], i, arr) => (
    <span key={status} className="ml-1">
      <span className="tabular-nums">{n}</span>
      <span className={cn("ml-1", STATUS_TEXT[status])}>{status}</span>
      {i < arr.length - 1 ? <span className="text-muted-foreground">,</span> : null}
    </span>
  ))
  return (
    <>
      {`${total} related runs: `}
      {parts}
    </>
  )
}
