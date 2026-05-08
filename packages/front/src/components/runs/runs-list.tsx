import { Skeleton } from "@/components/ui/skeleton"
import { ApiClient } from "@/lib/ApiClient"
import type { RunsSearch } from "@/lib/runs-search"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import type { RunSummary } from "@template/domain/run/RunSummary"
import type { TraceId } from "@template/domain/run/TraceId"
import type { WorkflowName } from "@template/domain/workflow/WorkflowName"
import { useEffect, useRef, useState } from "react"

interface UseRunsListResult {
  items: ReadonlyArray<RunSummary>
  hasMore: boolean
  loading: boolean
  error: string | null
  loadMore: () => void
}

const PAGE_SIZE = 50

export const useRunsList = (filters: RunsSearch): UseRunsListResult => {
  const filtersKey = JSON.stringify(filters)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [items, setItems] = useState<ReadonlyArray<RunSummary>>([])
  const [hasMore, setHasMore] = useState(false)
  const mergedKey = useRef<string>("")

  useEffect(() => {
    setItems([])
    setHasMore(false)
    setCursor(undefined)
    mergedKey.current = ""
  }, [filtersKey])

  const result = useAtomValue(
    ApiClient.query("runs", "listRuns", {
      urlParams: {
        limit: PAGE_SIZE,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.workflowName ? { workflowName: filters.workflowName as WorkflowName } : {}),
        ...(filters.traceId ? { traceId: filters.traceId as TraceId } : {}),
        ...(cursor ? { before: cursor } : {})
      },
      reactivityKeys: ["runs.list", filtersKey, cursor ?? "first"]
    })
  )

  useEffect(() => {
    if (!Result.isSuccess(result)) return
    const key = `${filtersKey}|${cursor ?? "first"}`
    if (mergedKey.current === key) return
    mergedKey.current = key
    const { items: pageItems, nextCursor } = result.value
    setItems((prev) => (cursor === undefined ? [...pageItems] : [...prev, ...pageItems]))
    setHasMore(nextCursor !== null)
  }, [result, cursor, filtersKey])

  const loadMore = () => {
    if (!Result.isSuccess(result)) return
    const next = result.value.nextCursor
    if (next !== null) setCursor(next)
  }

  const loading = items.length === 0 && !Result.isSuccess(result) && !Result.isFailure(result)
  const error = Result.isFailure(result) ? String(result.cause) : null

  return { items, hasMore, loading, error, loadMore }
}

export const RunsListSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
  </div>
)
