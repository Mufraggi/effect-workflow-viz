import { DataTable } from "@/components/ui/data-table"
import type { RunsSearch } from "@/lib/runs-search"
import { useNavigate } from "@tanstack/react-router"
import type { RunSummary } from "@template/domain/run/RunSummary"
import { useState } from "react"
import { runColumns } from "./columns.js"
import { RunsFilters } from "./runs-filters.js"
import { RunsListSkeleton, useRunsList } from "./runs-list.js"

interface Props {
  filters: RunsSearch
  onFiltersChange: (next: RunsSearch) => void
}

export const RunsPage = ({ filters, onFiltersChange }: Props) => {
  const navigate = useNavigate()
  const { error, hasMore, items, loadMore, loading } = useRunsList(filters)
  const [hoveredTrace, setHoveredTrace] = useState<string | null>(null)

  return (
    <main className="p-8 max-w-7xl mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-serif font-semibold">Runs</h1>
        <p className="text-muted-foreground text-sm">Workflow runs.</p>
      </header>

      <RunsFilters value={filters} onChange={onFiltersChange} />

      {loading
        ? <RunsListSkeleton />
        : error
        ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load runs: {error}
          </div>
        )
        : (
          <>
            <DataTable
              columns={runColumns}
              data={[...items]}
              onRowClick={(row) =>
                navigate({
                  to: "/runs/$messageId",
                  params: { messageId: String(row.id) },
                  search: filters
                })}
              onRowMouseEnter={(row) => setHoveredTrace(row.traceId ? String(row.traceId) : null)}
              onRowMouseLeave={() => setHoveredTrace(null)}
              getRowClassName={(row) => rowHighlight(row, hoveredTrace)}
              emptyMessage={items.length === 0 ? "No runs match these filters." : "No runs."}
            />

            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={loadMore}
                  className="rounded-md border border-border bg-background px-4 py-1.5 text-sm hover:bg-muted"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
    </main>
  )
}

const rowHighlight = (row: RunSummary, hoveredTrace: string | null): string | undefined => {
  if (hoveredTrace === null) return undefined
  if (row.traceId === null) return undefined
  return String(row.traceId) === hoveredTrace ? "bg-secondary/50" : undefined
}
