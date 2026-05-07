import { Result, useAtomValue } from "@effect-atom/atom-react"
import { ApiClient } from "@/lib/ApiClient"
import { DataTable } from "@/components/ui/data-table"
import { Skeleton } from "@/components/ui/skeleton"
import { runColumns } from "./columns.js"

export const RunsPage = () => {
  const result = useAtomValue(
    ApiClient.query("runs", "listRuns", {
      urlParams: { limit: 50 },
      reactivityKeys: ["runs.list"]
    })
  )

  return (
    <main className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-serif font-semibold">Runs</h1>
        <p className="text-muted-foreground text-sm">Latest 50 workflow runs.</p>
      </header>

      {Result.matchWithError(result, {
        onInitial: () => (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ),
        onError: (e) => (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to load runs: {String(e)}
          </div>
        ),
        onDefect: (d) => (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
            Defect: {String(d)}
          </div>
        ),
        onSuccess: (s) => <DataTable columns={runColumns} data={[...s.value.items]} />
      })}
    </main>
  )
}
