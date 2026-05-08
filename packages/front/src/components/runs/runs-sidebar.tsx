import type { RunsSearch } from "@/lib/runs-search"
import { cn } from "@/lib/utils"
import { Link, useNavigate } from "@tanstack/react-router"
import type { MessageId } from "@template/domain/run/MessageId"
import type { RunStatus } from "@template/domain/run/RunStatus"
import type { RunSummary } from "@template/domain/run/RunSummary"
import { RunsFilters } from "./runs-filters.js"
import { RunsListSkeleton, useRunsList } from "./runs-list.js"

const STATUS_DOT: Record<RunStatus, string> = {
  success: "bg-emerald-500",
  running: "bg-blue-500",
  pending: "bg-zinc-400",
  failed_app: "bg-red-500",
  crashed: "bg-red-700",
  interrupted: "bg-orange-500",
  unknown: "bg-zinc-400"
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "UTC"
})

const truncate = (s: string, n: number) => (s.length <= n + 3 ? s : `${s.slice(0, n)}…`)

interface Props {
  filters: RunsSearch
  onFiltersChange: (next: RunsSearch) => void
  selectedId: MessageId
}

export const RunsSidebar = ({ filters, onFiltersChange, selectedId }: Props) => {
  const navigate = useNavigate()
  const { error, hasMore, items, loadMore, loading } = useRunsList(filters)

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-3">
        <Link
          to="/"
          search={filters}
          className="block text-xs text-muted-foreground hover:text-foreground"
        >
          ← Full list
        </Link>
      </div>
      <div className="px-3 pt-3">
        <RunsFilters value={filters} onChange={onFiltersChange} />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {loading
          ? <RunsListSkeleton />
          : error
          ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-xs text-destructive">
              {error}
            </div>
          )
          : items.length === 0
          ? <p className="px-2 text-xs text-muted-foreground">No runs match these filters.</p>
          : (
            <ul className="space-y-1">
              {items.map((run) => (
                <SidebarRow
                  key={String(run.id)}
                  run={run}
                  selected={String(run.id) === String(selectedId)}
                  onSelect={() =>
                    navigate({
                      to: "/runs/$messageId",
                      params: { messageId: String(run.id) },
                      search: filters
                    })}
                />
              ))}
            </ul>
          )}
        {hasMore && (
          <div className="pt-3">
            <button
              type="button"
              onClick={loadMore}
              className="w-full rounded-md border border-border bg-background py-1.5 text-xs hover:bg-muted"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

const SidebarRow = ({
  onSelect,
  run,
  selected
}: {
  run: RunSummary
  selected: boolean
  onSelect: () => void
}) => (
  <li>
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-md border px-2.5 py-2 text-left text-xs transition",
        selected
          ? "border-foreground/30 bg-secondary"
          : "border-transparent hover:border-border hover:bg-secondary/40"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn("inline-block h-2 w-2 shrink-0 rounded-full", STATUS_DOT[run.status])}
          title={run.status}
        />
        <span className="min-w-0 flex-1 truncate font-medium">{run.workflowName}</span>
        <span className="font-mono tabular-nums text-[10px] text-muted-foreground">
          {run.startedAtProxy ? dateFmt.format(run.startedAtProxy) : "—"}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-2 pl-4 font-mono text-[10px] text-muted-foreground">
        <span>{truncate(String(run.runId), 16)}</span>
        {run.traceId && <span>· trace {truncate(String(run.traceId), 6)}</span>}
      </div>
    </button>
  </li>
)
